"use client";

import type { OptionGroup, OptionValue } from "@/lib/types";

export default function OptionSelector({
  groups,
  values,
  selected,
  onChange,
}: {
  groups: OptionGroup[];
  values: OptionValue[];
  selected: Record<string, string>;
  onChange: (groupId: string, valueId: string) => void;
}) {
  return (
    <div className="space-y-6">
      {groups.map((group) => {
        const groupValues = values
          .filter((v) => v.group_id === group.id)
          .sort((a, b) => a.sort_order - b.sort_order);

        return (
          <div key={group.id}>
            <label className="text-xs font-bold uppercase tracking-widest text-secondary">
              {group.label}
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              {groupValues.map((val) => {
                const isSelected = selected[group.id] === val.id;
                return (
                  <button
                    key={val.id}
                    type="button"
                    onClick={() => onChange(group.id, val.id)}
                    className={`rounded-xl border px-4 py-2 text-sm font-medium transition-all duration-150 ${
                      isSelected
                        ? "border-primary bg-primary text-white shadow-sm"
                        : "border-border text-secondary hover:border-primary/50 hover:text-text bg-white hover:bg-bg-light"
                    }`}
                  >
                    {val.label}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
