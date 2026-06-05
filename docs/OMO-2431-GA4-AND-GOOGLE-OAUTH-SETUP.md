# OMO-2431 GA4 + Google 로그인 세팅 가이드

> **결론:** 코드 작업은 이미 끝나 있다. 남은 작업은 **외부 콘솔에서 ID 발급 → `.env.local` + Vercel에 붙여넣기 → Supabase Google provider 활성화**. 보드/CEO 콘솔 작업만으로 완료된다.

---

## 1. 현재 상태 (코드 점검 결과)

| 항목 | 상태 | 비고 |
|------|------|------|
| GA4 `gtag` 스크립트 로더 | ✅ 코드 완료 | `src/app/layout.tsx:89-106` |
| Google Tag Manager 로더 | ✅ 코드 완료 | `src/app/layout.tsx:108-117` |
| Meta Pixel 로더 | ✅ 코드 완료 | `src/app/layout.tsx:118-144` |
| Microsoft Clarity 로더 | ✅ 코드 완료 | `src/app/layout.tsx:145-155` |
| Google Ads gtag | ✅ 코드 완료 | GA와 같은 스크립트에 연결 |
| Google 로그인 (Supabase OAuth) | ✅ 코드 완료 | `src/app/auth/login/page.tsx:42-55`, `src/app/auth/callback/route.ts` |
| `.env.local` 키 정의 | ✅ 키 모두 있음 | 값(ID)은 비어 있음 |
| Supabase Google provider 활성화 | ❓ 콘솔 확인 필요 | dashboard.supabase.com → Authentication → Providers |
| Google Cloud OAuth client | ❓ 콘솔 발급 필요 | console.cloud.google.com |

**즉, 코드 수정 0줄, 콘솔 작업만 남은 상태.**

---

## 2. Google Analytics 4 (GA4) 세팅

### 2-1. GA4 속성 만들기 (10분)

1. https://analytics.google.com → **관리** → **계정 만들기** (이미 있으면 스킵)
2. **속성 만들기**
   - 속성 이름: `Procardcrafters`
   - 보고 시간대: `(GMT-08:00) Los Angeles`
   - 통화: `USD`
3. 비즈니스 정보: 업종 `Retail`, 규모 `Small`
4. 비즈니스 목표 선택 (광고 효과 측정, 사용자 행동 분석 등 다 체크)
5. **데이터 스트림 만들기** → **웹**
   - 웹사이트 URL: `https://procardcrafters.com`
   - 스트림 이름: `Procardcrafters Web`
6. 생성 후 화면에 뜨는 **측정 ID `G-XXXXXXXXXX`** 를 복사

### 2-2. 환경 변수 붙여넣기

**로컬:** `.env.local`
```
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

**Vercel:** Project Settings → Environment Variables
- Key: `NEXT_PUBLIC_GA_MEASUREMENT_ID`
- Value: `G-XXXXXXXXXX`
- Environments: Production / Preview / Development 모두 체크
- **저장 후 재배포 필요** (env 변경은 next 빌드 시점에 inlining)

### 2-3. 확인

1. `pnpm/npm run dev` 후 `view-source:http://localhost:3000` 에 `googletagmanager.com/gtag/js?id=G-` 가 보이는지
2. GA4 → **보고서** → **실시간** 에서 본인 방문 카운트가 잡히는지

### (선택) GTM 통합

GTM도 쓸 거면 `NEXT_PUBLIC_GTM_CONTAINER_ID=GTM-XXXXXXX` 추가. GTM 컨테이너 안에서 GA4 태그를 만들면 GA4 측정 ID는 GTM에서 관리해도 됨. **둘 다 쓰면 이벤트 중복 위험** — 한쪽으로 통일 권장.

---

## 3. Google 로그인 (Supabase OAuth) 세팅

### 3-1. Google Cloud OAuth 클라이언트 발급 (15분)

1. https://console.cloud.google.com → 프로젝트 선택/생성 (`procardcrafters`)
2. **API 및 서비스 → OAuth 동의 화면**
   - User Type: `External`
   - 앱 이름: `Procardcrafters`
   - 사용자 지원 이메일: `admin@procardcrafters.com`
   - 승인된 도메인: `procardcrafters.com`, `supabase.co`
   - 개발자 연락처: 동일
   - 범위: `email`, `profile`, `openid` 만 추가 (민감 범위 X)
   - 테스트 사용자: 본인 이메일 (외부 공개 전까지)
3. **사용자 인증 정보 → 사용자 인증 정보 만들기 → OAuth 클라이언트 ID**
   - 유형: **웹 애플리케이션**
   - 이름: `Procardcrafters Web`
   - **승인된 자바스크립트 원본:**
     - `https://procardcrafters.com`
     - `http://localhost:3000`
   - **승인된 리디렉션 URI:** (Supabase 콜백 — 아래에서 복사)
     - `https://ilcfemvqommqyoohfoxw.supabase.co/auth/v1/callback`
4. 발급되는 **클라이언트 ID** 와 **클라이언트 시크릿** 복사

### 3-2. Supabase Provider 활성화 (3분)

1. https://supabase.com/dashboard/project/ilcfemvqommqyoohfoxw
2. **Authentication → Providers → Google**
3. **Enable** 토글 ON
4. **Client ID (for OAuth):** 3-1에서 복사한 값
5. **Client Secret (for OAuth):** 3-1에서 복사한 값
6. **Callback URL (for OAuth)** 가 화면에 표시됨 — 이 값을 3-1의 "승인된 리디렉션 URI" 와 정확히 일치시킬 것
7. Save

### 3-3. Supabase Redirect URL 화이트리스트

**Authentication → URL Configuration**
- Site URL: `https://procardcrafters.com`
- Redirect URLs (각 줄에 한 개):
  ```
  https://procardcrafters.com/auth/callback
  https://procardcrafters.com/**
  http://localhost:3000/auth/callback
  http://localhost:3000/**
  ```

### 3-4. 동작 확인

1. `/auth/login` 접속 → "Sign in with Google" 버튼 클릭
2. Google 동의 화면 → 본인 계정 선택
3. `/auth/callback?code=...` 로 돌아왔다가 `/mypage` 로 리다이렉트되면 성공
4. 실패 시: `?error=...` 쿼리에 사유가 붙음 (대부분 redirect URI mismatch)

---

## 4. (선택) Meta Pixel / Google Ads / Clarity

코드는 켜져 있으니 ID만 채우면 즉시 활성:

| 키 | 발급처 | 비고 |
|----|--------|------|
| `NEXT_PUBLIC_META_PIXEL_ID` | business.facebook.com → Events Manager | 15~16자리 숫자 |
| `NEXT_PUBLIC_GOOGLE_ADS_ID` | ads.google.com → Tools → Conversions | `AW-XXXXXXXXXX` |
| `NEXT_PUBLIC_CLARITY_PROJECT_ID` | clarity.microsoft.com | 무료, 세션 리플레이 |

---

## 5. 체크리스트 (실제 작업 순서)

- [ ] GA4 속성 만들고 `G-XXXXX` 복사
- [ ] `.env.local` 에 `NEXT_PUBLIC_GA_MEASUREMENT_ID` 붙여넣기
- [ ] Vercel env에 동일 키 등록 → 재배포
- [ ] GA4 실시간 보고서로 검증
- [ ] Google Cloud OAuth 클라이언트 발급
- [ ] Supabase → Providers → Google 활성화 + 키 입력
- [ ] Supabase → URL Configuration 화이트리스트 등록
- [ ] `/auth/login` 에서 Google 로그인 한 번 성공시켜 검증

체크 8개 끝나면 OMO-2431 완료.

---

## 6. 비용 / 보안 메모

- GA4, GTM, Clarity, Meta Pixel 모두 **무료**
- Google OAuth는 무료, 단 **동의 화면 "외부 공개"** 전까지 본인 등 테스트 사용자만 로그인 가능 → 프로덕션 직전 **앱 게시(Publish)** 필요
- 클라이언트 시크릿은 **Supabase에만** 저장, Git/.env 에 절대 커밋 금지
