# OMO-2557 — Google Ads API 접근 설정 가이드 (에이전트 자동화용)

> 목적: 보드의 **1회성 설정**으로 에이전트에 Google Ads **프로그래밍 접근**을 부여한다.
> 이후 전환 액션 생성·라벨 회수·GTM 태그 추가·검증까지 에이전트가 **자동 처리**한다.
> (전환을 UI에서 손으로 만드는 대신, 앞으로 모든 Google Ads 작업을 API로 자동화하기 위한 기반.)

설정이 끝나면 에이전트는 이 한 줄로 끝까지 수행한다:
```bash
node scripts/omo-2557-ads-api.mjs
# → 전환 액션 3개 생성 → Conversion ID/Label 회수 → fill 스크립트로 GTM import 파일 생성
```

---

## 회수해야 할 자격증명 5종

| 키 | 무엇 | 어디서 |
|----|------|--------|
| `GOOGLE_ADS_DEVELOPER_TOKEN` | Ads API 개발자 토큰 | MCC → Tools → API Center |
| `GOOGLE_OAUTH_CLIENT_ID` | OAuth 클라이언트 ID | Cloud Console → Credentials |
| `GOOGLE_OAUTH_CLIENT_SECRET` | OAuth 클라이언트 시크릿 | 〃 |
| `GOOGLE_OAUTH_REFRESH_TOKEN` | adwords 스코프 refresh token | OAuth Playground |
| `GOOGLE_ADS_CUSTOMER_ID` | 전환 만들 Ads 계정 ID(10자리) | Ads 우상단 계정번호 |
| `GOOGLE_ADS_LOGIN_CUSTOMER_ID` | (선택) MCC ID | 계정이 MCC 하위일 때만 |

---

## 1단계 — Google Cloud 프로젝트 + Ads API 활성화 (~3분)
1. https://console.cloud.google.com → 상단에서 프로젝트 생성(예: `pccf-ads-automation`).
2. **APIs & Services → Library** → "Google Ads API" 검색 → **Enable**.

## 2단계 — OAuth 동의 화면 + 클라이언트 (~5분)
1. **APIs & Services → OAuth consent screen** → User Type **External** → 앱 이름/이메일 입력 → 저장.
2. **Test users**에 본인 Google 계정(=Ads 접근 권한 있는 계정) 추가. (게시 안 해도 test user면 동작)
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
   - Application type: **Web application**
   - **Authorized redirect URIs**에 추가: `https://developers.google.com/oauthplayground`
   - 생성 후 **Client ID / Client Secret** 복사 → `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET`.

## 3단계 — Refresh Token 발급 (OAuth Playground, 코드 불필요, ~3분)
1. https://developers.google.com/oauthplayground → 우상단 **⚙(gear)** → **Use your own OAuth credentials** 체크 → 2단계의 Client ID/Secret 입력.
2. 좌측 입력란(Step 1)에 스코프 직접 입력: `https://www.googleapis.com/auth/adwords` → **Authorize APIs** → 본인 계정으로 동의.
3. **Step 2 → Exchange authorization code for tokens** → 표시되는 **Refresh token** 복사 → `GOOGLE_OAUTH_REFRESH_TOKEN`.

## 4단계 — 개발자 토큰 (Developer Token)
1. Google Ads **MCC(관리자) 계정** → **Tools & Settings → Setup → API Center** → Developer token 확인/신청 → `GOOGLE_ADS_DEVELOPER_TOKEN`.
2. 주의: **프로덕션 계정**에 전환을 만들려면 토큰이 **Basic access 이상**이어야 함(테스트 계정 토큰은 프로덕션 불가). 신청 시 승인까지 수 시간~1일 걸릴 수 있음.
   - MCC가 없으면 https://ads.google.com/home/tools/manager-accounts/ 에서 무료 생성 후 PCCF 계정을 그 아래로 연결.

## 5단계 — Customer ID
- Google Ads 로그인 → 우상단 10자리 계정번호(예: `123-456-7890`) → 하이픈 제거 → `GOOGLE_ADS_CUSTOMER_ID`.
- 이 계정이 MCC 하위면 MCC의 10자리 ID → `GOOGLE_ADS_LOGIN_CUSTOMER_ID`.

---

## 값 저장 위치 (중요 — 댓글에 붙여넣지 말 것)
로컬 동일 머신이므로, 비밀값은 **이 파일에 직접 저장**하세요(에이전트가 읽는 기본 경로, repo 밖이라 커밋 안 됨):

```
/Users/william/.paperclip/instances/default/workspaces/2bb373e7-cea0-47a6-9a24-b51ebfa59755/secrets/google-ads.env
```

형식은 `docs/google-ads.env.example` 그대로. 저장 후 이 이슈에 "secrets 저장 완료" 한 줄만 댓글 → 에이전트가 자동으로 이어서 실행/검증합니다.

> 부득이 댓글로 전달해야 하면 가능하지만, 에이전트가 즉시 파일로 옮기고 댓글은 삭제 권장(토큰 노출 최소화).

---

## 설정 후 에이전트 자동 수행 범위
1. `node scripts/omo-2557-ads-api.mjs` — 전환 액션 3개 생성(멱등) + Conversion ID/Label 회수.
2. `scripts/omo-2557-fill-ads-tags.sh` 자동 연동 → `docs/OMO-2557-gtm-ads-tags.filled.json` 생성.
3. GTM(`GTM-K3SCHZX3`) import(Merge/Overwrite) → Publish *(GTM API 접근도 부여되면 이 단계까지 자동, 아니면 import 파일만 전달)*.
4. 테스트 결제/리드로 "Recording conversions" 검증.

> 참고: GTM 게시까지 완전 자동화하려면 GTM API 접근(같은 OAuth 클라이언트에 `https://www.googleapis.com/auth/tagmanager.edit.containers` 스코프 추가 + 컨테이너 권한)도 부여하면 됨. 별도 자동화는 후속 이슈로 처리 가능.
