// OMO-3482 (board 2026-06-18, OMO-3452 thread): "그냥 성원꺼로 하자... 프린트시티
//   관련된거는 다 숨김처리해 데이터는 남겨놓고."
//
// printcity 노출 경로(라우트/리포트)를 UI에서 전부 숨긴다. 데이터 파일(JSON·lib·크롤러)은
// 재활성화 대비 보존하며, 이 플래그만으로 롤백 가능하다.
//
// 기본값 = 숨김(보드 결정). 재노출이 필요하면 env 에 PRINTCITY_HIDDEN=0 을 명시한다.
//   PRINTCITY_HIDDEN unset | '1' | 'true'  → 숨김
//   PRINTCITY_HIDDEN '0' | 'false'         → 노출(롤백)
export function isPrintcityHidden(): boolean {
  const v = process.env.PRINTCITY_HIDDEN?.trim().toLowerCase()
  return v !== '0' && v !== 'false'
}
