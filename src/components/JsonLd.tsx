// schema.org 구조화 데이터(JSON-LD)를 <script> 로 주입.
// 구글 리치 결과(별점·가격·breadcrumb)를 위한 공용 서버 컴포넌트.
export default function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return (
    <script
      type="application/ld+json"
      // 구조화 데이터는 신뢰된 서버 데이터로만 구성되므로 dangerouslySetInnerHTML 사용.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, '\\u003c'),
      }}
    />
  )
}
