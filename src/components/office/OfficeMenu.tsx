"use client";

// Hamburger menu in the office's top-left corner. Office-level actions live
// here: the Employees dialog (view, edit, fire, hire).
import { useEffect, useRef, useState } from "react";

export interface MenuItem {
  label: string;
  onSelect: () => void;
}

export function OfficeMenu({ items }: { items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
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

  return (
    <div ref={ref} className="absolute left-3 top-3 z-10 font-mono text-sm">
      <button
        type="button"
        aria-label="Office menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-9 flex-col items-center justify-center gap-[5px] border border-hairline bg-background/90 backdrop-blur hover:bg-background"
      >
        <span className="block h-px w-4 bg-foreground" />
        <span className="block h-px w-4 bg-foreground" />
        <span className="block h-px w-4 bg-foreground" />
      </button>
      {open && (
        <ul role="menu" className="mt-1 min-w-56 border border-hairline bg-background shadow-sm">
          {items.map((item) => (
            <li key={item.label} role="none">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
                className="block w-full px-3 py-2 text-left hover:bg-hairline/50"
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
