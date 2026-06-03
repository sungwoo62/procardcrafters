"use client";

import { ImageOff } from "lucide-react";

const PAPER_FALLBACK: Record<string, { description: string; weight: string; finish: string; feel: string }> = {
  "Art 250gsm": {
    description: "Smooth matte surface with excellent ink absorption.",
    weight: "250gsm",
    finish: "Matte coated",
    feel: "Crisp & professional",
  },
  "Snow White 250gsm": {
    description: "Bright white surface with vibrant colour reproduction.",
    weight: "250gsm",
    finish: "Silk coated",
    feel: "Premium & bright",
  },
  "Premium 300gsm": {
    description: "Extra thick stock for a truly premium, substantial card.",
    weight: "300gsm",
    finish: "Silk coated",
    feel: "Thick & luxurious",
  },
};

export default function PaperPopup({
  label,
  description,
  imageUrl,
}: {
  label: string;
  description?: string | null;
  imageUrl?: string | null;
}) {
  const fallback = PAPER_FALLBACK[label];
  const desc = description ?? fallback?.description;
  const weight = fallback?.weight;
  const finish = fallback?.finish;
  const feel = fallback?.feel;

  return (
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-52 rounded-xl border border-border bg-white shadow-lg shadow-black/10 overflow-hidden pointer-events-none">
      {/* 이미지 영역 */}
      <div className="relative h-28 bg-bg-light flex items-center justify-center">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={`${label} texture`}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center gap-1.5 text-border">
            <ImageOff size={28} strokeWidth={1.5} />
            <span className="text-[10px] text-secondary/50">질감 이미지 준비 중</span>
          </div>
        )}
      </div>

      {/* 정보 영역 */}
      <div className="p-3 space-y-2">
        <p className="text-xs font-bold text-text">{label}</p>
        {desc && <p className="text-[11px] text-secondary leading-relaxed">{desc}</p>}
        {(weight || finish || feel) && (
          <div className="grid grid-cols-3 gap-1 pt-1 border-t border-border">
            {weight && (
              <div className="text-center">
                <p className="text-[9px] uppercase tracking-wide text-secondary/60">Weight</p>
                <p className="text-[10px] font-semibold text-text">{weight}</p>
              </div>
            )}
            {finish && (
              <div className="text-center">
                <p className="text-[9px] uppercase tracking-wide text-secondary/60">Finish</p>
                <p className="text-[10px] font-semibold text-text leading-tight">{finish}</p>
              </div>
            )}
            {feel && (
              <div className="text-center">
                <p className="text-[9px] uppercase tracking-wide text-secondary/60">Feel</p>
                <p className="text-[10px] font-semibold text-text leading-tight">{feel}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
