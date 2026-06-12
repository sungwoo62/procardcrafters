# OMO-2972 — 직업별 니치 랜딩 콘텐츠 드립 큐 (20종)

부모: [OMO-2970](/OMO/issues/OMO-2970) 웨지 콘텐츠 레이어 · 인프라: [OMO-2971](/OMO/issues/OMO-2971)
작성/운영: Content (콘텐츠팀) · 2026-06-12 착수

## 생산 메커니즘 (2경로, OMO-2971 제공)
1. **SEED PR (현재 1차 배치에 사용)** — `src/lib/niche/professions.ts` 의 `SEED_PROFESSIONS` 에 추가 → main 머지 시 빌드 타임 정적 생성. 가장 신뢰성 높음(라이브 보장). 1차 배치는 이 경로로 배포.
2. **DB 드립 (2차 이후 양산용)** — Supabase `print_niche_pages` 테이블에 `is_published=true` row insert → 코드 배포 없이 추가(loader 가 slug 병합, 하루 ISR). ⚠️ 선결: 마이그레이션 `supabase/migrations/20260612_print_niche_pages.sql` 가 **아직 라이브 DB 미적용**. DB 경로로 양산하려면 먼저 이 마이그레이션 적용 필요(인프라/Dev-Print). 미적용 상태에서도 loader 는 SEED 로 무해 폴백.

## 🔒 정직성 가드레일 (OMO-2760 / OMO-2972) — 모든 카피 공통
성원애드피아(Sungwon Adpia) 카탈로그 검증 결과(`src/config/swadpia-finishing-fields.ts`, 2026-06-08 라이브 조사):

| 마감 | 성원 생산 | 카피 사용 |
|------|----------|----------|
| 박 / Metallic Foil (금/은/로즈골드/홀로그램) | ✅ | `foil-stamping` 사용 |
| 형압 / Emboss·Deboss | ✅ | `emboss-deboss` 사용 (※ "letterpress" 표기 금지 — 성원은 형압만) |
| 에폭시 / Raised Gloss | ✅ | `raised-gloss` 사용 (※ "spot UV"는 코팅 needs_audit → raised-gloss로 정직 표기) |
| 도무송·귀도리 / Die-Cut·Rounded | ✅ | `die-cut` 사용 |
| 용지 / Textured & Specialty Stock | ✅ | `textured-stock` 사용 |
| 인쇄 QR | ✅ (단순 인쇄 아트워크) | `qr-smart` 사용 |
| **NFC 칩 카드** | ❌ 카탈로그에 칩 임베딩 없음 | **카피·메타·useCase·FAQ 전면 금지** |
| **Painted/colored edges** | ❌ 엣지 도색 필드 없음 | **제외** |

- ❌ 가짜 후기 / 가짜 stat / AggregateRating 스키마 금지 (jsonld.ts 이미 미부착).
- NFC 가 생산 가능해지면(향후 성원 외 공급처 확보 등) 재도입 검토 — 그 전까지 QR-only.

## 1차 배치 — ✅ 라이브 배포 (SEED, main 머지)
| # | slug | 직업 | 핀터레스트/광고 앵글 | 상태 |
|---|------|------|--------------------|------|
| 1 | `realtors` | Realtors | 오픈하우스 QR→매물링크, 포일 | ✅ live (교정: NFC→QR) |
| 2 | `photographers` | Photographers | 텍스처 스톡 + QR→포트폴리오 | ✅ live (교정: letterpress→emboss, NFC→QR) |
| 3 | `lawyers` | Lawyers & Attorneys | 중후한 스톡+절제된 포일=신뢰 | ✅ live (신규) |
| 4 | `contractors` | Contractors | 두꺼운 카드 냉장고 생존 + QR→견적폼 | ✅ live (신규) |
| 5 | `tattoo-artists` | Tattoo Artists | 다이컷+포일 + QR→인스타/예약 | ✅ live (신규) |

## 2차 이후 드립 큐 — 주 2-3개 (나머지 15종, OMO-2383 Lens2 정합)
각 페이지: 직업맥락 H1/메타/유스케이스 + 검증마감 4종 + FAQ 3개(40단어 직접답변, GEO/AEO) + 내부링크 3개(형제 직업 2 + 허브). NFC 금지·QR-only.

### Week 2 (D+7)
| slug | 직업 | 앵글 노트 | 추천 마감 |
|------|------|----------|----------|
| `electricians` | Electricians | 안전·자격 강조, QR→리뷰/긴급콜 | textured-stock, foil-stamping, die-cut, qr-smart |
| `plumbers` | Plumbers | 냉장고 마그넷 경쟁, QR→예약 | textured-stock, foil-stamping, qr-smart |
| `barbers` | Barbers | 다이컷+포일, QR→예약앱(Booksy 등) | foil-stamping, die-cut, raised-gloss, qr-smart |

### Week 3 (D+14)
| slug | 직업 | 앵글 노트 | 추천 마감 |
|------|------|----------|----------|
| `salons` | Salons (Hair/Nail) | 럭셔리 텍스처+로즈골드 포일, QR→예약 | foil-stamping, raised-gloss, textured-stock, qr-smart |
| `makeup-artists` | Makeup Artists | 뷰티 비주얼, QR→포트폴리오/예약 | foil-stamping, raised-gloss, qr-smart |
| `personal-trainers` | Personal Trainers | QR→무료세션 폼/인스타 | foil-stamping, die-cut, qr-smart |

### Week 4 (D+21)
| slug | 직업 | 앵글 노트 | 추천 마감 |
|------|------|----------|----------|
| `dentists` | Dentists | 신뢰·청결 톤, QR→예약/리콜 | foil-stamping, emboss-deboss, textured-stock, qr-smart |
| `djs` | DJs | 다크 스톡+홀로그램 포일, QR→믹스/예약 | foil-stamping, raised-gloss, die-cut, qr-smart |
| `fitness-coaches` | Fitness Coaches | QR→프로그램 신청/인스타 | foil-stamping, die-cut, qr-smart |

### Week 5 (D+28)
| slug | 직업 | 앵글 노트 | 추천 마감 |
|------|------|----------|----------|
| `food-trucks` | Food Trucks | 다이컷 로고형+QR→메뉴/위치 | foil-stamping, die-cut, qr-smart |
| `pet-groomers` | Pet Groomers | 친근+다이컷, QR→예약 | die-cut, foil-stamping, qr-smart |
| `freelance-designers` | Freelance Designers | 미니멀 텍스처+엠보스, QR→포트폴리오 | emboss-deboss, textured-stock, raised-gloss, qr-smart |

### Week 6 (D+35)
| slug | 직업 | 앵글 노트 | 추천 마감 |
|------|------|----------|----------|
| `consultants` | Consultants | 신뢰·절제, QR→캘린들리/링크드인 | foil-stamping, emboss-deboss, textured-stock, qr-smart |
| `mortgage-brokers` | Mortgage Brokers | 금융 신뢰, QR→사전승인 폼 | foil-stamping, textured-stock, qr-smart |
| `real-estate-brokers` | Real Estate Brokers | realtors 변형(브로커리지 리더), QR→팀/매물 | foil-stamping, raised-gloss, textured-stock, qr-smart |

> 주: `real-estate-brokers` 는 `realtors` 와 키워드 카니발 주의 — 브로커리지/팀 리더 각도로 차별화하고 상호 내부링크.

## 운영 노트
- 내부링크 메시: 신규 페이지 추가 시 인접 1차 배치 페이지의 `internalLinks` 에 역링크 1개 추가해 고립 페이지 방지.
- C3(SNS, OMO-2973) 핀터레스트 핀 목적지 = 위 slug URL `/business-cards/for/{slug}`.
- C4(광고, OMO-2974) 직업별 키워드 랜딩 = 동일 URL. C4 는 신뢰게이트(OMO-2975)+전환추적 선결.
- 성과 데이터(Analytics) 수신 후 전환 높은 직업 우선 심화/배치 재정렬.
