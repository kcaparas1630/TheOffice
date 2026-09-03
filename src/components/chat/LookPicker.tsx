"use client";

// Change how an agent looks in the pixel office. Lives in the chat header so
// the person you're looking at is the person you're dressing.
import { useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/server/convex/_generated/api";
import { SPRITE_CATALOG, spriteUrl } from "@/lib/office/sprites";

export function LookPicker({ agentName, current }: { agentName: string; current: string | null }) {
  const setSprite = useMutation(api.agents.setSprite);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const choose = async (sprite: string | undefined) => {
    setError(null);
    try {
      await setSprite({ name: agentName, sprite });
      setOpen(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg.match(/Uncaught Error: (.*?)(\n|$)/)?.[1] ?? msg.split("\n")[0]);
    }
  };

  const label = SPRITE_CATALOG.find((s) => s.id === current)?.label ?? "auto";

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="shrink-0 border border-hairline px-2 py-0.5 text-xs font-mono text-foreground hover:border-foreground"
        title="Change how they look in the office"
      >
        look: {label} ▾
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-1 w-[26rem] max-w-[80vw] border border-hairline bg-background p-3 shadow-sm">
          <div className="flex flex-wrap gap-2">
            {SPRITE_CATALOG.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => choose(s.id)}
                aria-pressed={current === s.id}
                className={`flex w-16 flex-col items-center gap-1 border px-1 pt-1 pb-0.5 text-[10px] leading-tight ${
                  current === s.id ? "border-foreground" : "border-hairline text-muted hover:border-muted"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- pixel art */}
                <img src={spriteUrl(s.id, "front")} alt={s.label} width={28} height={56} />
                {s.label}
              </button>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-muted">
            <button type="button" onClick={() => choose(undefined)} className="hover:underline">
              let the office pick
            </button>
            {error && <span className="text-failed">{error}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
