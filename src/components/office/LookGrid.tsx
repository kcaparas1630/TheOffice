"use client";

// The sprite catalogue as a grid of thumbnails. Used by the hire form and
// the Employees dialog's Look tab.
import { SPRITE_CATALOG, spriteUrl } from "@/lib/office/sprites";

export function LookGrid({
  value,
  onChange,
  size = 40,
}: {
  value: string | null;
  onChange: (id: string) => void;
  size?: number;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {SPRITE_CATALOG.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onChange(s.id)}
          aria-pressed={value === s.id}
          className={`flex flex-col items-center gap-1 border px-2 pt-1.5 pb-1 text-[11px] leading-tight ${
            value === s.id ? "border-foreground" : "border-hairline text-muted hover:border-muted"
          }`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- pixel art, no optimization wanted */}
          <img src={spriteUrl(s.id, "front")} alt={s.label} width={size} height={size * 2} />
          {s.label}
        </button>
      ))}
    </div>
  );
}
