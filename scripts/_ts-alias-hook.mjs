// 임시: node --experimental-strip-types 로 앱 코드를 import 하는 라이브 하니스용 resolve hook.
//  - '@/x'  → src/x  (tsconfig paths)
//  - './x'  → 확장자(.ts/.tsx/...) 보강 (TS 의 extensionless relative import 지원)
import { existsSync } from 'node:fs'
const EXTS = ['', '.ts', '.tsx', '.mjs', '.js', '/index.ts', '/index.tsx']
export async function resolve(specifier, context, next) {
  let baseHref = null
  if (specifier.startsWith('@/')) {
    baseHref = new URL('../src/' + specifier.slice(2), import.meta.url).href
  } else if (specifier.startsWith('.') && context.parentURL) {
    baseHref = new URL(specifier, context.parentURL).href
  }
  if (baseHref) {
    for (const ext of EXTS) {
      const u = new URL(baseHref + ext)
      if (existsSync(u)) return { url: u.href, shortCircuit: true }
    }
  }
  return next(specifier, context)
}
