# OMO-2319 명함 디자인 에디터 고도화 — Plan

작성일 2026-06-04 · CEO

## 문제 정의 (보드 원문)

1. **Required + Info 중복 레이어** — Required 필드가 들어간 상태에서 Info를 입력하고 Apply Design 누르면 레이어가 중복으로 여러 개 생긴다.
2. **Required/Info 통합 + 미입력 경고** — Required 섹션을 없애고 Info 안에 "Required" 표기, 미입력 시 작업 차단 경고.
3. **Info 커스텀 텍스트 레이어** — 고객이 Info에서 임의 텍스트 필드(레이어)를 추가할 수 있어야 한다.
4. **템플릿 미반영 버그** — 템플릿 선택해도 캔버스에 반영이 안 되는 경우가 있다.
5. **저해상도 이미지 경고 + 동의 게이트** — 로고/이미지 업로드 시 해상도·크기 체크해서 저화질이면 경고하고, 동의 안 하면 다음 단계로 못 넘어가게.
6. **기타 — 챌린저/경쟁사 조사 후 추가 고도화.**

## 코드 분석 (검증된 메커니즘)

대상 파일: `src/app/design/[slug]/EditorClient.tsx` (4472줄, fabric.js 기반)

### #1 중복 레이어 — 메커니즘 확인

- 템플릿(`buildTemplate`) 이 만든 Textbox 는 `data.fieldKey` 만 가짐 (예: line 949 `data: { ... fieldKey: 'name' }`).
- `applyContactFields()` (line 2409) 은 `existing` 필터를 `o.data?.fieldType` 으로만 함 (line 2427).
- 템플릿 박스는 `fieldType` 이 없으므로 `existing.length === 0` 통과 → 7개 Info 박스 신규 추가 → 같은 의미(name/title/email…)의 박스 두 벌 공존.
- `applyRequiredField()` (line 2468) 은 `fieldKey || fieldType` 둘 다 체크해서 그쪽은 OK.

**근본 원인:** 두 코드 경로가 같은 의미의 필드를 서로 다른 키(`fieldKey` vs `fieldType`)로 태깅 + 매칭 비대칭.

### #2 Info 커스텀 텍스트 — 미구현

- Info 탭 렌더링 (line 3779–3811) 은 고정 7필드 (name/title/company/phone/email/website/linkedin) 만 표시.
- "Add field" 같은 동적 추가 UI 없음.

### #3 템플릿 미반영 — 추가 조사 필요

- `TEMPLATE_CATALOG` 에 120+ 템플릿 정의 (line 261~).
- `buildTemplate()` 에 `name === 'X'` 분기 120 개 가량 존재.
- 카탈로그에 있지만 buildTemplate 분기에 없는 템플릿이 있을 가능성. → 자식 이슈에서 매칭 갭 grep + 보고.
- 또는 `loadTemplate()` 이 호출은 되지만 `clearUserObjects()` 가 너무 공격적이거나 분기에서 좌표가 캔버스 밖 (큰 사이즈 제품에서 명함 좌표 사용) 일 가능성.

### #4 이미지 업로드 — 검증 부재

- `handleImageUpload()` (line 2753) 와 `handleLogoUpload()` (line 2534) 모두 파일 크기·해상도·DPI 체크 코드 없음.
- 60% 캔버스 스케일링만 적용.

### #5 주문 전 검증 — 부재

- `proceedToOrder()` (line 3507) 는 PDF 생성 후 바로 업로드 → `/order` 이동.
- 캔버스 비어있음 / 필수 미입력 / 저DPI 이미지 / 안전영역 침범 → 어느 것도 차단 안 함.
- `runPreflight()` (Print Check 버튼) 이 있긴 한데 경고만 띄우고 강제 안 함.

## 경쟁사/업계 패턴 적용 방침

| 항목 | Moo.com | Vistaprint | Canva | 우리 선택 |
|---|---|---|---|---|
| 데이터 입력 패널 | 좌측 stepper + 사이드 텍스트 편집 | Smart Fill (한 번 입력 → 모든 텍스트 박스 자동 채움) | 텍스트 직접 편집 | **Vistaprint Smart Fill 채택 + Required 표기** |
| 커스텀 텍스트 | "Text" 도구로 자유 추가 | 동적 필드 추가 | "Text" 도구 | **Info 패널 안에 "Add field" + 라벨 입력** |
| 이미지 품질 경고 | DPI 인디케이터 (Good/Fair/Poor) | 모달 + 명시적 동의 필수 | 인라인 배지 | **인라인 배지 + 주문 전 모달 동의 게이트** |
| 템플릿 적용 | 사용자 입력 유지하면서 디자인 교체 | 마찬가지 (Smart Fill 덕분) | 텍스트 교체됨 | **사용자 입력 우선 보존** |
| 주문 전 검증 | 단계별 검증 | 모달로 모든 이슈 + 동의 | 자동 (사용자가 알아서) | **Pre-flight 모달 + 차단 게이트** |

## 통합 아키텍처 — 단일 데이터 모델

핵심 결정: **Required + Info 를 "Smart Fill" 데이터 패널 한 개로 통합**한다.

```
┌─ Sidebar Tab: "Your Info" (현 Required + Info 통합) ─┐
│ * Name              [Jane Doe        ]  ← required │
│ * Title             [Creative Dir    ]  ← required │
│ * Company           [ACME Studio     ]  ← required │
│ * Phone             [+1 555-1234     ]  ← required │
│ * Email             [jane@acme.com   ]  ← required │
│   Website           [               ]              │
│   LinkedIn          [               ]              │
│   ─────────────────────────────────                │
│   + Add custom field                               │
│   [Tagline] [Believe in design    ]  [✕]           │
│   ─────────────────────────────────                │
│   [ Apply to design ]                              │
└────────────────────────────────────────────────────┘
```

- 데이터 모델: `Record<fieldKey, { value: string; required: boolean; label: string }>` 통합.
- 캔버스 Textbox tag: `data.fieldKey` 하나로 통일. `fieldType` 제거 또는 alias 처리.
- 매칭: `canvas.getObjects().filter(o => o.data?.fieldKey === key)` 만 사용.
- "Apply to design" 누르면 모든 필드 일괄 동기화 (Smart Fill). 비어있는 required 가 있으면 → 빨간 경고 + 적용 중단.

## 자식 이슈 분해 — 6 트랙

| ID | 트랙 | 우선순위 | 의존 |
|---|---|---|---|
| A | **Smart Fill 데이터 모델 통합** (Required + Info → 하나의 패널, `fieldKey` 단일 태그, 매칭 통일) | high | 없음 |
| B | **커스텀 필드 동적 추가** (Info 패널 안에 "Add field" + 라벨/값 입력, 캔버스 Textbox 생성, 레이어 패널 동기화) | medium | A |
| C | **Required 미입력 경고 게이트** (`Apply to design` 시 + `proceedToOrder` 시 빈 required → 모달 + 차단) | high | A |
| D | **템플릿 미반영 버그 재현 + 수정** (catalog ↔ buildTemplate 매칭 갭 검사, 좌표 범위 체크, 사용자 입력 보존 정책 적용) | high | A (Smart Fill 데이터로 템플릿 채움) |
| E | **이미지 해상도 검증 + 동의 게이트** (업로드 시 DPI 계산, 인라인 배지, 주문 전 모달, 동의 체크박스 필수) | high | 없음 |
| F | **Pre-flight 주문 차단** (필수 미입력 / 저DPI / 안전영역 침범을 한 모달에 모아서 동의 또는 차단) | medium | C, E |

E 와 A 는 병렬 진행 가능. C/F 는 A/E 가 끝나면 통합 작업.

## 검증

- 각 트랙별로 Playwright 또는 수동 시나리오:
  1. 빈 캔버스 → Info만 입력 → Apply → 단일 레이어 셋
  2. 템플릿 'Corporate' 선택 → Info name 입력 → Apply → 중복 없이 갱신
  3. 100×100 px PNG 로고 업로드 → 저DPI 배지 표시 + 주문 모달에서 차단
  4. Required 미입력 상태 → Order 버튼 → 차단 모달
- `runPreflight()` 결과를 주문 흐름에 통합하는 회귀 테스트.

## 마이그레이션 / 데이터 호환

- 기존 저장된 디자인은 `fieldType` 만 가진 Textbox 가 있을 수 있음. 로드 시 `fieldKey ??= fieldType` 백필.
- `applyContactFields` 함수는 제거 또는 `applyAllFields(fields)` 로 흡수.
- REQUIRED_FIELDS schema 는 유지 (제품별 필수 매핑은 그대로 의미 있음).

## 다음 액션

- 보드 승인 후 자식 이슈 6개 (A–F) 생성. 우선 A→C→D 트랙은 본 issue 의 진척률 결정자.
- 트랙 E (이미지 품질) 는 독립적으로 병렬 작업 가능. 자체 디자인 결정만 필요.
