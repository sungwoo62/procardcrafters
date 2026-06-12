import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
export async function resolve(specifier, context, next) {
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && !/\.[a-zA-Z0-9]+$/.test(specifier) && context.parentURL) {
    const cand = new URL(specifier + '.ts', context.parentURL)
    if (existsSync(fileURLToPath(cand))) return next(cand.href, context)
  }
  return next(specifier, context)
}
