'use client'

export default function GlobalError({
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', textAlign: 'center' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>문제가 발생했습니다</h2>
        <button
          onClick={() => unstable_retry()}
          style={{
            padding: '0.5rem 1.5rem',
            background: '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: '0.5rem',
            cursor: 'pointer',
          }}
        >
          다시 시도
        </button>
      </body>
    </html>
  )
}
