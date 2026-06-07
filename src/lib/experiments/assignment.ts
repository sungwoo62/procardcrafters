// 변형 배정 — 가중 결정론적 해시 (sticky) (OMO-2596)
import type { ExperimentVariant } from './types'

// FNV-1a 32-bit 해시 — 동일 (experimentKey, sessionId) → 동일 버킷
function hashToUnit(input: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  // 부호 없는 32-bit → [0, 1)
  return (h >>> 0) / 0xffffffff
}

/**
 * 활성 변형 중 가중치에 비례해 결정론적으로 하나를 고른다.
 * 같은 입력은 항상 같은 변형을 반환(sticky)하므로 저장 없이도 일관적이며,
 * assignments 테이블 캐시와 결합해 가중치 변경에도 기존 배정을 유지할 수 있다.
 */
export function pickVariant(
  experimentKey: string,
  sessionId: string,
  variants: ExperimentVariant[]
): ExperimentVariant | null {
  const active = variants.filter((v) => v.is_active && v.weight > 0)
  if (active.length === 0) return null
  if (active.length === 1) return active[0]

  const totalWeight = active.reduce((s, v) => s + v.weight, 0)
  if (totalWeight <= 0) return null

  const point = hashToUnit(`${experimentKey}:${sessionId}`) * totalWeight
  let cumulative = 0
  for (const v of active) {
    cumulative += v.weight
    if (point < cumulative) return v
  }
  // 부동소수 경계 보정
  return active[active.length - 1]
}
