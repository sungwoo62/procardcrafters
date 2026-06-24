// 블로그 공개 게이트 (OMO-3813)
// 공유 DB(`print_blog_*`)의 블로그 콘텐츠 — 카테고리명 8종 + 기사 30개 본문/excerpt 가 한글이라
// US 고객/검색 노출을 차단한다. DB 데이터는 보존하고 서빙만 막는다(가역적).
// 영문화 + OMO-2760 대외 콘텐츠 승인 게이트 완료 후, Vercel 환경변수 `BLOG_PUBLIC=true` 주입 +
// 재배포로 즉시 재개한다. 미설정(기본값) = 게이트 닫힘(안전 기본).
export const BLOG_PUBLIC = process.env.BLOG_PUBLIC === 'true'
