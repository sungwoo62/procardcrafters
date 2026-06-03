"use client";

import { useMemo } from "react";
import { Tag } from "lucide-react";
import type { PriceRule, OptionGroup, OptionValue } from "@/lib/types";

export default function PriceCalculator({
  rules,
  groups,
  values,
  selected,
}: {
  rules: PriceRule[];
  groups: OptionGroup[];
  values: OptionValue[];
  selected: Record<string, string>;
}) {
  const matchedPrice = useMemo(() => {
    if (groups.length === 0) return null;

    const selectionMap: Record<string, string> = {};
    for (const group of groups) {
      const valueId = selected[group.id];
      if (!valueId) return null;
      const val = values.find((v) => v.id === valueId);
      if (!val) return null;
      selectionMap[group.name] = val.name;
    }

    const match = rules.find((rule) => {
      const combo = rule.option_combination;
      return Object.entries(combo).every(
        ([key, val]) => selectionMap[key] === val
      );
    });

    return match?.price ?? null;
  }, [rules, groups, values, selected]);

  return (
    <div className="rounded-2xl border border-border overflow-hidden">
      <div className="bg-bg-light px-6 py-4 border-b border-border flex items-center gap-2">
        <Tag size={14} className="text-secondary" strokeWidth={1.75} />
        <p className="text-xs font-bold uppercase tracking-widest text-secondary">
          Your Price
        </p>
      </div>
      <div className="bg-white px-6 py-5">
        {matchedPrice != null ? (
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-extrabold text-text">
              ${matchedPrice.toFixed(2)}
            </span>
            <span className="text-sm font-medium text-secondary">USD</span>
          </div>
        ) : (
          <p className="text-sm font-medium text-secondary">
            Select all options above to see pricing
          </p>
        )}
      </div>
    </div>
  );
}
