# OMO-2595 — Google Ads/Meta 광고비 일배치 적재

OMO-2587 마케팅 측정 토대의 후속(2/4). `print_ad_spend`(채널×캠페인×일자)에
Google Ads/Meta의 일자별 spend/impressions/clicks/conversions를 일배치로 upsert해
`/admin/marketing`의 **Blended ROAS/CPA** 및 **채널별 ROAS**를 활성화한다.

> 북극성 축3: 마케팅 성과측정 및 평가와 개선.

## 구성요소

| 파일 | 역할 |
|---|---|
| `src/lib/ad-spend.ts` | 적재 엔진 — Google Ads/Meta fetch + 순수 파서 + `print_ad_spend` upsert + 오케스트레이터 |
| `src/app/api/cron/ingest-ad-spend/route.ts` | 일배치 cron 라우트 (CRON_SECRET 가드) |
| `vercel.json` | `0 9 * * *` (매일 09:00 UTC) cron 등록 |
| `scripts/analytics/backfill-ad-spend.mjs` | 과거 N일 백필 — 위 라우트를 호출(로직 단일 소스) |
| `src/lib/__tests__/ad-spend.test.ts` | 파서/날짜범위 단위 테스트 |

## 동작

- 매일 09:00 UTC cron이 **최근 3일**(`days=3`)을 겹쳐 재동기화한다.
  플랫폼이 전일 spend/전환을 사후 보정(finalize)하므로 겹침이 필요하다.
- `(spend_date, channel, campaign)` UNIQUE 기준 **upsert** → 멱등.
- **자격증명이 없는 채널은 `skipped`로 정직하게 보고**하고 데이터를 만들지 않는다(추측 적재 금지).
  → 대시보드는 광고비 0일 때 ROAS/CPA를 `null`로 표시(OMO-2587 정책).

## 활성화에 필요한 Vercel Production env

채널별로 아래 변수가 **모두** 있어야 해당 채널이 흐른다. 하나라도 없으면 그 채널은 skip.

### Google Ads (OMO-2557 OAuth 자격증명 재사용)
```
GOOGLE_ADS_DEVELOPER_TOKEN
GOOGLE_OAUTH_CLIENT_ID
GOOGLE_OAUTH_CLIENT_SECRET
GOOGLE_OAUTH_REFRESH_TOKEN
GOOGLE_ADS_CUSTOMER_ID          # 10자리, 하이픈 제거
GOOGLE_ADS_LOGIN_CUSTOMER_ID    # (선택) MCC 하위 계정일 때 MCC ID
GOOGLE_ADS_API_VERSION          # (선택) 기본 v18
```
> 주의: 클라이언트측 `NEXT_PUBLIC_GOOGLE_ADS_ID`(AW- 전환 픽셀)와는 다른,
> **서버측 Reporting API** 자격증명이다. OMO-2557 setup 스크립트
> (`scripts/omo-2557-ads-setup.mjs`)의 루프백 OAuth로 발급한 값을 사용한다.

### Meta (Marketing API)
OMO-2552 Meta CAPI 셋업이 적재한 `PCCF_META_*`를 **우선 재사용**한다(동일 system-user 토큰).
신규 `META_*` 명도 폴백 지원.
```
PCCF_META_LONG_LIVED_TOKEN  (또는 META_ACCESS_TOKEN)   # ads_read 권한 필요
PCCF_META_AD_ACCOUNT_ID     (또는 META_AD_ACCOUNT_ID)  # act_ 제거된 숫자 ID
META_API_VERSION                                       # (선택) 기본 v21.0
```
> ⚠️ Vercel에 `PCCF_META_*` **키는 존재**하나(2d 전 CAPI 셋업), 값이 실제로
> 채워졌는지는 sensitive env라 로컬 `vercel env pull`로 확인 불가(빈 값으로 내려옴).
> 배포 후 cron 응답의 `channels[].status`로 확인할 것(ok/error/skipped).
> 또한 CAPI 토큰에 `ads_read`(Insights) 스코프가 없으면 `status:"error"`가 날 수 있다.

### 공통(이미 설정됨)
```
CRON_SECRET                     # cron/수동호출 Bearer 인증
SUPABASE_SERVICE_ROLE_KEY       # print_ad_spend upsert(RLS 우회)
NEXT_PUBLIC_SUPABASE_URL
```

## 통화 주의

`spend_usd` 컬럼은 **계정 통화 단위**로 적재되며 실제 통화코드는 `currency` 컬럼에 기록된다.
계정이 USD가 아니면 Blended ROAS의 분모가 USD가 아닌 점을 감안할 것(향후 환율 정규화는 별도 이슈).

## 운영

```bash
# 수동 점검(인증 필요)
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://omoongmoo.com/api/cron/ingest-ad-spend?days=3"

# 과거 30일 백필
node scripts/analytics/backfill-ad-spend.mjs --days 30

# 특정 채널만
node scripts/analytics/backfill-ad-spend.mjs --days 7 --channel google_ads
```

응답 예시:
```json
{
  "range": { "since": "2026-06-05", "until": "2026-06-07", "days": 3 },
  "channels": [
    { "channel": "google_ads", "status": "ok", "rows": 12, "spend": 84.21 },
    { "channel": "meta", "status": "skipped", "reason": "credentials_missing", "rows": 0, "spend": 0 }
  ],
  "upserted": 12
}
```
