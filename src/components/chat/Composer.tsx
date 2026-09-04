"use client";

// Message box with two pickers: `@` suggests people and `/` suggests
// commands with a runnable example each. Nothing opens on focus or click
// unless the draft already starts with `/` or ends in an `@`.
// Enter sends, Shift+Enter breaks the line; while a picker is open, ↑↓ move
// (hover does too) and Tab/Enter accept. A "to" chip shows who a plain
// message goes to.
import { useRef, useState } from "react";
import { fillCommand, matchCommands, type CommandSpec } from "@/lib/commands";

const MENTION_RE = /(^|\s)@([A-Za-z0-9-]*)$/;
const COMMAND_RE = /^\/([A-Za-z]*)$/;

type Picker =
  | { kind: "mention"; matches: string[]; index: number; start: number }
  | { kind: "command"; matches: CommandSpec[]; index: number };

const ROW = "block w-full px-3 py-1.5 text-left transition-colors hover:bg-hairline";
const ACTIVE = "bg-hairline";

export function Composer({
  roster,
  selectedName,
  onSelectName,
  placeholder,
  busy,
  onSubmit,
}: {
  roster: string[];
  selectedName: string | null;
  onSelectName: (name: string) => void;
  placeholder: string;
  busy: boolean;
  onSubmit: (text: string) => void;
}) {
  const [value, setValue] = useState("");
  const [picker, setPicker] = useState<Picker | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);

  const refreshPicker = (text: string, caret: number) => {
    const before = text.slice(0, caret);
    const mention = before.match(MENTION_RE);
    if (mention) {
      const partial = mention[2].toLowerCase();
      const matches = roster.filter((n) => n.toLowerCase().startsWith(partial));
      if (matches.length > 0) {
        return setPicker({ kind: "mention", matches, index: 0, start: caret - mention[2].length - 1 });
      }
    }
    const command = text.match(COMMAND_RE);
    if (command) {
      const matches = matchCommands(command[1]);
      if (matches.length > 0) return setPicker({ kind: "command", matches, index: 0 });
    }
    setPicker(null);
  };

  const place = (next: string, pos: number) => {
    setValue(next);
    setPicker(null);
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  };

  const acceptMention = (name: string) => {
    if (picker?.kind !== "mention") return;
    const caret = ref.current?.selectionStart ?? value.length;
    const next = `${value.slice(0, picker.start)}@${name} ${value.slice(caret)}`;
    place(next, picker.start + name.length + 2);
  };

  const acceptCommand = (spec: CommandSpec) => {
    const next = fillCommand(spec, selectedName);
    place(next, next.length);
  };

  const accept = () => {
    if (!picker) return;
    if (picker.kind === "mention") acceptMention(picker.matches[picker.index]);
    else acceptCommand(picker.matches[picker.index]);
  };

  const highlight = (index: number) => picker && setPicker({ ...picker, index });

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
        const n = picker.matches.length;
        highlight((picker.index + delta + n) % n);
        return;
      }
      if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) {
        // Enter on a suggestion fills it in; a filled command with nothing
        // else to add (e.g. /help, /email Name) sends on the next Enter.
        e.preventDefault();
        accept();
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

  const openSuggestions = () => {
    const el = ref.current;
    refreshPicker(value, el?.selectionStart ?? value.length);
  };

  return (
    <div className="relative border-t border-hairline px-4 py-3">
      {picker?.kind === "mention" && (
        <ul role="listbox" aria-label="People" className="absolute bottom-full left-4 mb-1 min-w-40 border border-hairline bg-background text-sm shadow-sm">
          {picker.matches.map((name, i) => (
            <li key={name} role="option" aria-selected={i === picker.index}>
              <button
                type="button"
                onMouseEnter={() => highlight(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  acceptMention(name);
                }}
                className={`${ROW} ${i === picker.index ? ACTIVE : ""}`}
              >
                @{name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {picker?.kind === "command" && (
        <ul
          role="listbox"
          aria-label="Commands"
          className="absolute bottom-full left-4 right-4 mb-1 border border-hairline bg-background text-sm shadow-sm"
        >
          {picker.matches.map((spec, i) => (
            <li key={spec.name} role="option" aria-selected={i === picker.index}>
              <button
                type="button"
                onMouseEnter={() => highlight(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  acceptCommand(spec);
                }}
                className={`${ROW} ${i === picker.index ? ACTIVE : ""}`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-mono font-semibold">{spec.usage}</span>
                  <span className="truncate text-xs text-muted">{spec.description}</span>
                </div>
                <div className="truncate font-mono text-[11px] text-muted">e.g. {spec.example}</div>
              </button>
            </li>
          ))}
          <li className="border-t border-hairline px-3 py-1 text-[10px] text-muted">
            ↑↓ choose · Tab/Enter fill in · Esc close · @Name to talk instead
          </li>
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
        onFocus={openSuggestions}
        onClick={openSuggestions}
        onBlur={() => setPicker(null)}
        className="w-full resize-none bg-transparent font-mono text-sm outline-none placeholder:text-muted disabled:opacity-60"
      />
      <div className="mt-1 flex items-center justify-between gap-3 text-[10px] text-muted">
        <label className="flex items-center gap-1">
          to
          <select
            aria-label="Send plain messages to"
            value={selectedName ?? ""}
            onChange={(e) => e.target.value && onSelectName(e.target.value)}
            disabled={roster.length === 0}
            className="bg-transparent font-mono text-foreground outline-none"
          >
            {roster.length === 0 && <option value="">nobody yet</option>}
            {roster.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <span>@Name to talk · / for commands · Enter sends, Shift+Enter new line</span>
      </div>
    </div>
  );
}
