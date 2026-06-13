// OMO-3058: 인쇄 색상 주의사항(RGB↔CMYK) 고객 안내.
// 보드 요청: 모니터=RGB, 인쇄=CMYK 라 화면과 인쇄색이 다를 수 있음 + 녹색/네온 재현 한계.
// 날씨/온도/습도 등 생산환경 얘기는 제외(B2C 단납기엔 과함, 보드 합의).
// 사이트가 영어권 대상이라 고객 문구는 영어, 주석은 한국어.
import { Info } from 'lucide-react'

export default function PrintColorNotice() {
  return (
    <details className="group rounded-xl border border-amber-200 bg-amber-50/60 p-4">
      <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-amber-900 marker:content-['']">
        <Info className="h-4 w-4 shrink-0" />
        Color accuracy — please read before ordering
        <span className="ml-auto text-xs font-normal text-amber-600 group-open:hidden">show</span>
        <span className="ml-auto hidden text-xs font-normal text-amber-600 group-open:inline">hide</span>
      </summary>
      <ul className="mt-3 space-y-2 text-sm leading-relaxed text-amber-900/90">
        <li>
          <strong>Screens show RGB, we print in CMYK.</strong> Monitors and phones emit colored
          light (RGB); printing mixes ink (CMYK). Your printed colors can look different from what
          you see on screen.
        </li>
        <li>
          <strong>Some colors are hard to reproduce</strong> — vivid greens, bright oranges, deep
          blues, and any neon / fluorescent tones fall outside the CMYK range and will print more
          muted than on your monitor.
        </li>
        <li>
          Monitor brightness and calibration also change how colors appear, so two screens rarely
          match exactly.
        </li>
        <li>
          We print to industry-standard CMYK. For brand-critical colors, please request a proof
          before full production — and design in CMYK where possible.
        </li>
      </ul>
    </details>
  )
}
