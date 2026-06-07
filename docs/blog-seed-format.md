# 블로그 시드(seed) JSON 포맷 — OMO-2569

콘텐츠를 `print_blog_categories` / `print_blog_posts` 에 적재하기 위한 JSON 포맷.
자식 B(콘텐츠 작성)는 이 포맷에 맞춰 JSON 을 만들면 됩니다.

## 적재 방법

```bash
# .env.local 에 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 필요
node scripts/seed-blog.mjs <path-to-seed.json>

# 예시(샘플 2건):
node scripts/seed-blog.mjs scripts/seed/blog-sample.json
```

- **멱등(idempotent)**: 카테고리는 `slug`, 글은 `slug` 기준 **upsert**. 같은 JSON 을 반복 실행해도 중복 없이 갱신됩니다.
- 콘텐츠 수정 → 같은 `slug` 로 다시 실행하면 덮어쓰기.
- 카테고리를 먼저 upsert 한 뒤 글의 `category`(slug)를 id 로 매핑하므로, **카테고리와 글을 한 파일에 같이 넣어도** 됩니다.

## 최상위 구조

```jsonc
{
  "categories": [ /* BlogCategory[] */ ],
  "posts":      [ /* BlogPost[] */ ]
}
```

둘 다 선택적(둘 중 하나만 넣어도 됨). 카테고리만 먼저 만들고 글은 나중에 적재해도 됩니다.

## categories[] — 카테고리

| 필드 | 타입 | 필수 | 설명 |
|------|------|:---:|------|
| `slug` | string | ✅ | URL 세그먼트. 소문자-하이픈. 고유. 예) `guides` → `/blog/guides` |
| `name` | string | ✅ | 표시 이름. 예) `Printing Guides` |
| `description` | string | | 아카이브 헤더 + 메타 설명에 사용 |
| `sort_order` | number | | 네비게이션 정렬(오름차순). 미지정 시 배열 순서 |

## posts[] — 글

| 필드 | 타입 | 필수 | 설명 |
|------|------|:---:|------|
| `slug` | string | ✅ | URL 세그먼트(고유). canonical URL = `/blog/{category}/{slug}` |
| `category` | string | | 카테고리 **slug**(id 아님). 스크립트가 id 로 매핑. 누락 시 `general` 경로로 노출 |
| `title` | string | ✅ | 글 제목(H1) |
| `excerpt` | string | | 카드/리스트 요약 + 메타 설명 폴백 |
| `body_md` | string | ✅* | **마크다운 원문**. 렌더 규칙은 아래 참조 (`*` 빈 문자열 허용하지만 권장 X) |
| `cover_image_url` | string | | 표지 이미지(카드 썸네일 + 본문 상단 히어로) |
| `body_images` | object[] | | 본문 인라인 이미지 메타(치수/캡션). 아래 참조 |
| `tags` | string[] | | 태그. 키워드 메타 + 표시 |
| `seo_title` | string | | `<title>` 오버라이드. 없으면 `{title} \| Procardcrafters Blog` |
| `seo_description` | string | | meta description 오버라이드. 없으면 `excerpt` |
| `og_image_url` | string | | OG/트위터 카드 이미지. 없으면 `cover_image_url` |
| `is_published` | boolean | | `true` 만 공개 노출(RLS + 쿼리 필터). 기본 `false` |
| `published_at` | string(ISO) | | 발행일시. 미지정 + `is_published=true` 면 적재 시각 자동 |

### body_images[] — 인라인 이미지 메타

본문 `![alt](url)` 의 `url` 과 **정확히 일치**하면 치수·캡션을 적용합니다(없어도 렌더는 됨, 기본 16:9).

| 필드 | 타입 | 필수 | 설명 |
|------|------|:---:|------|
| `url` | string | ✅ | 본문 `![](...)` 의 URL 과 동일해야 매칭 |
| `alt` | string | | 대체 텍스트(마크다운 alt 보다 우선) |
| `caption` | string | | 이미지 하단 캡션 |
| `width` | number | | 실제 가로 px — 정확한 비율로 CLS 방지(권장) |
| `height` | number | | 실제 세로 px |

> **이미지 도메인**: `next/image` 화이트리스트(`next.config.ts`)는 현재 `*.supabase.co/storage/...` 와 `images.unsplash.com` 만 허용. 다른 호스트 이미지를 쓰려면 `remotePatterns` 에 추가해야 합니다. **권장: Supabase Storage 에 업로드 후 public URL 사용.**

## 본문 마크다운(`body_md`) 지원 문법

외부 의존성 없는 안전한 서브셋(`src/components/BlogMarkdown.tsx`). raw HTML 은 렌더하지 않습니다(XSS 차단).

| 문법 | 결과 |
|------|------|
| `# ~ ####` | 헤딩(`#` 은 본문 H2 로, 페이지 H1 은 `title`) |
| 빈 줄로 구분된 텍스트 | 문단 `<p>` |
| `**굵게**` / `*기울임*` / `` `코드` `` | 인라인 강조 |
| `[텍스트](/내부경로)` | 내부 `next/link` |
| `[텍스트](https://외부)` | 새 탭 `<a target=_blank rel=noopener>` |
| `- 항목` / `* 항목` | 순서 없는 리스트 |
| `1. 항목` | 순서 있는 리스트 |
| `> 인용` | blockquote |
| ` ```\n코드\n``` ` | 코드 블록 |
| `---` | 수평선 |
| **`![alt](url)` (단독 줄)** | **`next/image` 인라인 이미지** — `body_images` 로 치수/캡션 매칭 |

⚠️ 인라인 이미지는 **자체 줄**에 있어야 next/image 로 렌더됩니다(문단 중간 이미지는 미지원).

## 라우트/SEO 동작(자동)

- `/blog` 인덱스, `/blog/{category}` 아카이브, `/blog/{category}/{slug}` 본문 — 발행 글만 노출.
- per-article `generateMetadata`: title/description/OG/canonical 자동.
- JSON-LD: `Article` + `BreadcrumbList` 자동 주입.
- `sitemap.ts`: 발행 글/카테고리 URL 자동 포함.
- 관련글: 같은 카테고리 우선 + 최신글 보충(내부링크).
- URL 의 카테고리가 글의 실제 카테고리와 다르면 canonical 경로로 자동 리다이렉트(중복 인덱싱 방지).

## 최소 예시

```json
{
  "categories": [
    { "slug": "guides", "name": "Printing Guides", "sort_order": 1 }
  ],
  "posts": [
    {
      "slug": "my-first-post",
      "category": "guides",
      "title": "My First Post",
      "excerpt": "짧은 요약.",
      "body_md": "## 소제목\n\n본문 **굵게**.\n\n![대체텍스트](https://images.unsplash.com/photo-...?w=1280&q=80)",
      "body_images": [
        { "url": "https://images.unsplash.com/photo-...?w=1280&q=80", "alt": "대체텍스트", "width": 1280, "height": 720 }
      ],
      "tags": ["business-cards"],
      "is_published": true,
      "published_at": "2026-06-01T09:00:00Z"
    }
  ]
}
```
