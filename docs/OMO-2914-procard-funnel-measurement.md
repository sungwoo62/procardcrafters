# OMO-2914 (R2) — procardcrafters 라이브 퍼널 측정 재정의

> OMO-2891 위클리 사이트 신호 루틴이 참조하는 **라이브 전환 퍼널의 단일 진실원천**.
> 1차 패스(OMO-2911)가 전제한 `/quote` 견적 퍼널은 **라이브에 없음(404)** — 비-라이브 미니앱에만 존재.
> 아래는 실제 라이브 동선 기준으로 재정의한 퍼널과, GA4 Data API 의존 없이 **DB 만으로** 돌릴 수 있는 위클리 SQL.

## 1. 라이브 전환 동선 (실측)

```
products/[slug]  →  /order (주문폼)  →  주문 생성  →  결제 완료
  view_item        begin_checkout      order_created     paid
```

- **cart 단계는 실제로 존재하지 않음.** `src/app/cart/page.tsx` 는 MVP 에서 stub 으로 대체됨
  ("cart replaced by direct product → order flow"). 제품 상세 → "Configure Your Order" → `/order` 직행.
- 따라서 1차 패스가 쓰던 "add_to_cart" 단계는 **begin_checkout(주문폼 진입)** 으로 대체해 해석한다.
  (`trackAddToCart` 는 정의돼 있으나 호출처가 없는 죽은 코드 — cart 제거의 잔재.)

## 2. 단계별 계측 소스 매핑

| 퍼널 단계 | 이벤트 | GA4/Pixel | **DB 소스 (위클리 루틴용)** |
|-----------|--------|-----------|------------------------------|
| ① 제품 조회 | `view_item` | ✅ (ViewItemTracker) | **`print_funnel_events` (event_type='view_item')** ← OMO-2914 신규 |
| ② 주문폼 진입 | `begin_checkout` | ✅ (OrderForm) | **`print_funnel_events` (event_type='begin_checkout')** ← OMO-2914 신규 |
| ③ 주문 생성 | — | — | `print_orders` (row 생성, `created_at`) |
| ④ 결제 완료 | `purchase` | ✅ (PurchaseTracker) | `print_order_events` (event_type='payment_received') |

**왜 신규 테이블이 필요했나:** ①②는 GA4/dataLayer 전용이라 DB 에서 안 보였다. GA4 Data API 조회는
보드 OAuth 키 대기(**OMO-2894**)로 막혀 있어, 위클리 루틴이 ①→②→③ 이탈을 측정할 수 없었다.
`print_funnel_events`(1st-party fire-and-forget 싱크, omoongmoo `goods_analytics_events` 대응)가 그 갭을 메운다.
적재 경로: `src/lib/analytics.ts` → `POST /api/analytics/funnel-event` → service_role insert.

## 3. 위클리 퍼널 SQL (DB-only, GA4 불필요)

### 3-1. 4단계 퍼널 카운트 + 단계 전환율 (최근 7일)

```sql
with win as (
  select now() - interval '7 days' as t0
),
v as (  -- ① 제품 조회 (세션 단위 distinct)
  select count(distinct session_id) filter (where session_id is not null)
       + count(*) filter (where session_id is null) as n
  from print_funnel_events, win
  where event_type = 'view_item' and created_at >= win.t0
),
c as (  -- ② 주문폼 진입 (세션 단위 distinct)
  select count(distinct session_id) filter (where session_id is not null)
       + count(*) filter (where session_id is null) as n
  from print_funnel_events, win
  where event_type = 'begin_checkout' and created_at >= win.t0
),
o as (  -- ③ 주문 생성
  select count(*) as n from print_orders, win where created_at >= win.t0
),
p as (  -- ④ 결제 완료
  select count(distinct order_id) as n
  from print_order_events, win
  where event_type = 'payment_received' and created_at >= win.t0
)
select
  v.n  as product_views,
  c.n  as begin_checkout,
  o.n  as orders_created,
  p.n  as orders_paid,
  round(100.0 * c.n / nullif(v.n,0), 1) as view_to_checkout_pct,
  round(100.0 * o.n / nullif(c.n,0), 1) as checkout_to_order_pct,
  round(100.0 * p.n / nullif(o.n,0), 1) as order_to_paid_pct,
  round(100.0 * p.n / nullif(v.n,0), 1) as overall_cvr_pct
from v, c, o, p;
```

### 3-2. 상위 이탈 제품 (조회는 많은데 checkout 적은 제품, 최근 7일)

```sql
select
  product_slug,
  count(*) filter (where event_type='view_item')      as views,
  count(*) filter (where event_type='begin_checkout')  as checkouts,
  round(100.0 * count(*) filter (where event_type='begin_checkout')
        / nullif(count(*) filter (where event_type='view_item'),0), 1) as view_to_checkout_pct
from print_funnel_events
where created_at >= now() - interval '7 days' and product_slug is not null
group by product_slug
having count(*) filter (where event_type='view_item') >= 5
order by views desc, view_to_checkout_pct asc
limit 15;
```

### 3-3. 유입 referrer 분포 (조회 기준, 최근 7일)

```sql
select coalesce(nullif(referrer,''),'(direct)') as referrer,
       count(*) as views,
       count(distinct session_id) as sessions
from print_funnel_events
where event_type='view_item' and created_at >= now() - interval '7 days'
group by 1 order by views desc limit 15;
```

## 4. 한계 / 후속

- **세션↔주문 미스티칭:** `print_funnel_events.session_id`(익명 _pcsid)가 `print_orders` 에 전달되지 않아
  ③④는 **집계 카운트**로만 잡힌다(동일 세션 종단 추적 X). v1 은 단계별 비율로 충분.
  종단 추적이 필요하면 주문 생성 시 session_id 를 `print_orders` 에 기록하는 후속 작업 필요.
- **데이터 누적 대기:** 테이블은 배포 시점부터 적재 시작 → 첫 1주는 표본 부족. 누적 후 신호 해석.
- **GA4 교차검증:** OMO-2894(GA4 Data API 키) 발급되면 동일 퍼널을 GA4 로 교차검증 가능.
- **봇 필터:** 필요 시 위클리 루틴에서 referrer/UA 기반 봇 트래픽 제외(omoongmoo 선례).

## 5. 베이스라인 (배포 직전, DB 실측)

- `print_orders`: 29건 (2026-05-13 ~ 2026-06-04)
- `print_order_events` payment_received: 2건
- `print_funnel_events`: 0건 (신규, 배포 후 적재 시작)
- 즉, 종전엔 ③④만 보였고 ①② 가시성 0 → R2 로 상단 퍼널 측정 개통.
