import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  findForbiddenBrandMentions,
  FORBIDDEN_BRAND_MENTIONS,
} from "../brandGuard";

// 고객 노출 카피가 사는 디렉토리만 스캔한다.
const CUSTOMER_FACING_ROOTS = ["src/app", "src/components"];

// 가드 구현·테스트는 금지어를 의도적으로 포함하므로 제외.
const EXCLUDE_SUBSTRINGS = ["brandGuard"];

function collectSourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...collectSourceFiles(full));
    } else if (/\.(tsx?|mdx?)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe("brandGuard — 고객 노출 카피 타사/모회사 브랜드명 금지 (OMO-2975)", () => {
  it("금지어 목록이 비어있지 않다", () => {
    expect(FORBIDDEN_BRAND_MENTIONS.length).toBeGreaterThan(0);
  });

  it("findForbiddenBrandMentions 가 금지어를 대소문자 무시로 탐지한다", () => {
    expect(findForbiddenBrandMentions("powered by SUNGWON adpia")).toContain(
      "Sungwon Adpia",
    );
    expect(findForbiddenBrandMentions("commercial-grade printing")).toEqual([]);
  });

  it("src/app·src/components 에 금지 브랜드명이 0건이어야 한다", () => {
    const violations: string[] = [];
    for (const root of CUSTOMER_FACING_ROOTS) {
      for (const file of collectSourceFiles(root)) {
        if (EXCLUDE_SUBSTRINGS.some((s) => file.includes(s))) continue;
        const hits = findForbiddenBrandMentions(readFileSync(file, "utf8"));
        if (hits.length > 0) {
          violations.push(`${file} → ${hits.join(", ")}`);
        }
      }
    }
    expect(violations, `금지 브랜드명 발견:\n${violations.join("\n")}`).toEqual(
      [],
    );
  });
});
