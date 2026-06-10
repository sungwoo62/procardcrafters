// Node 모듈 resolve 훅 — `@/...` 임포트를 src/ 절대경로로 매핑한다. (OMO-2841)
// generate-quote-samples.mjs 가 실제 TS 빌더(@/lib/email 등)를 그대로 import 하기 위함.
import { pathToFileURL } from 'node:url'
import { existsSync } from 'node:fs'
import path from 'node:path'

const SRC = path.resolve(process.cwd(), 'src')

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    const base = path.join(SRC, specifier.slice(2))
    let resolved = base
    if (!path.extname(base)) {
      for (const ext of ['.ts', '.tsx', '.js']) {
        if (existsSync(base + ext)) {
          resolved = base + ext
          break
        }
      }
      if (resolved === base && existsSync(path.join(base, 'index.ts'))) {
        resolved = path.join(base, 'index.ts')
      }
    }
    return { url: pathToFileURL(resolved).href, shortCircuit: true }
  }
  return nextResolve(specifier, context)
}
