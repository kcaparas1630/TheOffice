"use client";

// Message box with an `@` mention picker. Enter sends, Shift+Enter breaks
// the line; while the picker is open, arrows move and Tab/Enter accept.
import { useRef, useState } from "react";

const TOKEN_RE = /(^|\s)@([A-Za-z0-9-]*)$/;

export function Composer({
  roster,
  placeholder,
  busy,
  onSubmit,
}: {
  roster: string[];
  placeholder: string;
  busy: boolean;
  onSubmit: (text: string) => void;
}) {
  const [value, setValue] = useState("");
  const [picker, setPicker] = useState<{ matches: string[]; index: number; start: number } | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);

  const refreshPicker = (text: string, caret: number) => {
    const before = text.slice(0, caret);
    const m = before.match(TOKEN_RE);
    if (!m) return setPicker(null);
    const partial = m[2].toLowerCase();
    const matches = roster.filter((n) => n.toLowerCase().startsWith(partial));
    if (matches.length === 0) return setPicker(null);
    setPicker({ matches, index: 0, start: caret - m[2].length - 1 });
  };

  const accept = (name: string) => {
    if (!picker) return;
    const el = ref.current;
    const caret = el?.selectionStart ?? value.length;
    const next = `${value.slice(0, picker.start)}@${name} ${value.slice(caret)}`;
    setValue(next);
    setPicker(null);
    requestAnimationFrame(() => {
      if (!el) return;
      const pos = picker.start + name.length + 2;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  };

  const submit = () => {
    const text = value.trim();
    if (!text) return;
    setValue("");
    setPicker(null);
    onSubmit(text);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (picker) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const delta = e.key === "ArrowDown" ? 1 : -1;
        setPicker({
          ...picker,
          index: (picker.index + delta + picker.matches.length) % picker.matches.length,
        });
        return;
      }
      if (e.key === "Tab" || e.key === "Enter") {
        e.preventDefault();
        accept(picker.matches[picker.index]);
        return;
      }
      if (e.key === "Escape") {
        setPicker(null);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="relative border-t border-hairline px-4 py-3">
      {picker && (
        <ul className="absolute bottom-full left-4 mb-1 min-w-40 border border-hairline bg-background text-sm shadow-sm">
          {picker.matches.map((name, i) => (
            <li key={name}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  accept(name);
                }}
                className={`block w-full px-3 py-1 text-left ${i === picker.index ? "bg-hairline/60" : ""}`}
              >
                @{name}
              </button>
            </li>
          ))}
        </ul>
      )}
      <textarea
        ref={ref}
        value={value}
        rows={Math.min(5, Math.max(1, value.split("\n").length))}
        placeholder={placeholder}
        disabled={busy}
        onChange={(e) => {
          setValue(e.target.value);
          refreshPicker(e.target.value, e.target.selectionStart ?? e.target.value.length);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => setPicker(null)}
        className="w-full resize-none bg-transparent font-mono text-sm outline-none placeholder:text-muted disabled:opacity-60"
      />
      <p className="mt-1 text-[10px] text-muted">
        @Name to talk · /task Name … · /run Name · /redo Name critique · /help
      </p>
    </div>
  );
}
