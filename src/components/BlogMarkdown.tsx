import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'

// 블로그 본문 마크다운 → React 렌더. 외부 의존성 없이 안전한 서브셋만 지원.
// 핵심: 인라인 이미지(`![alt](url)`)를 next/image 로 노출(LCP 최적화 + 도메인 화이트리스트).
// 본문은 service_role 로 적재된 신뢰 콘텐츠지만, raw HTML 은 파싱하지 않으므로 XSS 표면이 없다.

export interface BlogImageMeta {
  url: string
  alt?: string
  caption?: string
  width?: number
  height?: number
}

interface BlogMarkdownProps {
  body: string
  // body_images: url → 메타(치수/캡션). 인라인 이미지 렌더 정밀도용.
  images?: BlogImageMeta[]
}

// 기본 이미지 비율 (메타에 치수 없을 때) — 16:9.
const DEFAULT_IMG_W = 1280
const DEFAULT_IMG_H = 720

function escapeKey(s: string, i: number): string {
  return `${i}-${s.slice(0, 8)}`
}

// 인라인 마크업 파싱: **bold**, *italic*, `code`, [text](url).
// 이미지/블록은 블록 파서에서 별도 처리.
function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = []
  // 토큰 정규식: 코드 → 링크 → 볼드 → 이탤릭 순.
  const pattern = /(`[^`]+`)|(\[[^\]]+\]\([^)]+\))|(\*\*[^*]+\*\*)|(\*[^*]+\*)/g
  let last = 0
  let m: RegExpExecArray | null
  let idx = 0
  while ((m = pattern.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index))
    const tok = m[0]
    if (tok.startsWith('`')) {
      nodes.push(
        <code key={escapeKey('c', idx)} className="rounded bg-gray-100 px-1.5 py-0.5 text-sm font-mono text-pink-600">
          {tok.slice(1, -1)}
        </code>,
      )
    } else if (tok.startsWith('[')) {
      const lm = /\[([^\]]+)\]\(([^)]+)\)/.exec(tok)
      if (lm) {
        const [, label, href] = lm
        const internal = href.startsWith('/')
        nodes.push(
          internal ? (
            <Link key={escapeKey('l', idx)} href={href} className="text-blue-600 underline hover:text-blue-800">
              {label}
            </Link>
          ) : (
            <a
              key={escapeKey('l', idx)}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline hover:text-blue-800"
            >
              {label}
            </a>
          ),
        )
      }
    } else if (tok.startsWith('**')) {
      nodes.push(
        <strong key={escapeKey('b', idx)} className="font-semibold text-gray-900">
          {tok.slice(2, -2)}
        </strong>,
      )
    } else if (tok.startsWith('*')) {
      nodes.push(
        <em key={escapeKey('i', idx)} className="italic">
          {tok.slice(1, -1)}
        </em>,
      )
    }
    last = m.index + tok.length
    idx++
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

function ImageBlock({ alt, url, meta, keyId }: { alt: string; url: string; meta?: BlogImageMeta; keyId: string }) {
  const width = meta?.width ?? DEFAULT_IMG_W
  const height = meta?.height ?? DEFAULT_IMG_H
  const caption = meta?.caption
  const altText = meta?.alt ?? alt
  return (
    <figure key={keyId} className="my-8">
      <Image
        src={url}
        alt={altText}
        width={width}
        height={height}
        sizes="(max-width: 768px) 100vw, 768px"
        className="h-auto w-full rounded-xl shadow-sm"
      />
      {caption ? <figcaption className="mt-2 text-center text-sm text-gray-500">{caption}</figcaption> : null}
    </figure>
  )
}

export default function BlogMarkdown({ body, images = [] }: BlogMarkdownProps) {
  const imgMap = new Map(images.map((im) => [im.url, im]))
  const lines = body.replace(/\r\n/g, '\n').split('\n')
  const blocks: ReactNode[] = []

  let i = 0
  let para: string[] = []

  const flushPara = () => {
    if (para.length === 0) return
    const text = para.join(' ')
    blocks.push(
      <p key={`p-${blocks.length}`} className="my-4 leading-relaxed text-gray-700">
        {renderInline(text)}
      </p>,
    )
    para = []
  }

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    // 빈 줄 → 문단 종료
    if (trimmed === '') {
      flushPara()
      i++
      continue
    }

    // 코드 펜스
    if (trimmed.startsWith('```')) {
      flushPara()
      const code: string[] = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        code.push(lines[i])
        i++
      }
      i++ // 닫는 펜스 소비
      blocks.push(
        <pre key={`pre-${blocks.length}`} className="my-6 overflow-x-auto rounded-lg bg-gray-900 p-4 text-sm text-gray-100">
          <code>{code.join('\n')}</code>
        </pre>,
      )
      continue
    }

    // 이미지 (단독 라인): ![alt](url)
    const imgMatch = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(trimmed)
    if (imgMatch) {
      flushPara()
      const [, alt, url] = imgMatch
      blocks.push(<ImageBlock key={`img-${blocks.length}`} keyId={`img-${blocks.length}`} alt={alt} url={url} meta={imgMap.get(url)} />)
      i++
      continue
    }

    // 헤딩
    const h = /^(#{1,4})\s+(.*)$/.exec(trimmed)
    if (h) {
      flushPara()
      const level = h[1].length
      const content = renderInline(h[2])
      const cls =
        level === 1
          ? 'mt-10 mb-4 text-3xl font-bold text-gray-900'
          : level === 2
            ? 'mt-9 mb-3 text-2xl font-bold text-gray-900'
            : level === 3
              ? 'mt-7 mb-2 text-xl font-semibold text-gray-900'
              : 'mt-6 mb-2 text-lg font-semibold text-gray-900'
      const key = `h-${blocks.length}`
      if (level === 1) blocks.push(<h2 key={key} className={cls}>{content}</h2>)
      else if (level === 2) blocks.push(<h2 key={key} className={cls}>{content}</h2>)
      else if (level === 3) blocks.push(<h3 key={key} className={cls}>{content}</h3>)
      else blocks.push(<h4 key={key} className={cls}>{content}</h4>)
      i++
      continue
    }

    // 인용
    if (trimmed.startsWith('> ')) {
      flushPara()
      const quote: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('> ')) {
        quote.push(lines[i].trim().slice(2))
        i++
      }
      blocks.push(
        <blockquote key={`q-${blocks.length}`} className="my-6 border-l-4 border-blue-400 bg-blue-50/50 py-2 pl-4 italic text-gray-600">
          {renderInline(quote.join(' '))}
        </blockquote>,
      )
      continue
    }

    // 수평선
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      flushPara()
      blocks.push(<hr key={`hr-${blocks.length}`} className="my-8 border-gray-200" />)
      i++
      continue
    }

    // 순서 없는 리스트
    if (/^[-*]\s+/.test(trimmed)) {
      flushPara()
      const items: string[] = []
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ''))
        i++
      }
      blocks.push(
        <ul key={`ul-${blocks.length}`} className="my-4 list-disc space-y-1 pl-6 text-gray-700">
          {items.map((it, k) => (
            <li key={k}>{renderInline(it)}</li>
          ))}
        </ul>,
      )
      continue
    }

    // 순서 있는 리스트
    if (/^\d+\.\s+/.test(trimmed)) {
      flushPara()
      const items: string[] = []
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ''))
        i++
      }
      blocks.push(
        <ol key={`ol-${blocks.length}`} className="my-4 list-decimal space-y-1 pl-6 text-gray-700">
          {items.map((it, k) => (
            <li key={k}>{renderInline(it)}</li>
          ))}
        </ol>,
      )
      continue
    }

    // 일반 문단 라인 누적
    para.push(trimmed)
    i++
  }
  flushPara()

  return <div className="blog-body">{blocks}</div>
}
