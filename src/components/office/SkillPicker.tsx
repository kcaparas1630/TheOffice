"use client";

// Pick skills from the catalogue and set a level for each. Controlled: the
// parent owns the list, so the hire form can submit it in one go and the
// Skills tab can save each change straight away.
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/server/convex/_generated/api";
import type { Id } from "@/server/convex/_generated/dataModel";
import { LEVEL_LABELS, MAX_LEVEL, MIN_LEVEL, usesToNext } from "@/lib/skills";
import { FIELD, LABEL } from "./HireForm";

export interface PickedSkill {
  skillId: Id<"skills">;
  name: string;
  level: number;
  uses?: number;
}

export function LevelSelect({
  id,
  value,
  onChange,
}: {
  id?: string;
  value: number;
  onChange: (level: number) => void;
}) {
  return (
    <select
      id={id}
      aria-label="Level"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="border border-hairline bg-transparent px-1 py-0.5 text-xs font-mono"
    >
      {Array.from({ length: MAX_LEVEL - MIN_LEVEL + 1 }, (_, i) => i + MIN_LEVEL).map((l) => (
        <option key={l} value={l}>
          {l} · {LEVEL_LABELS[l]}
        </option>
      ))}
    </select>
  );
}

export function SkillPicker({
  value,
  onAdd,
  onLevel,
  onRemove,
  onOpenSkills,
}: {
  value: PickedSkill[];
  onAdd: (skill: { skillId: Id<"skills">; name: string }) => void;
  onLevel: (skillId: Id<"skills">, level: number) => void;
  onRemove: (skillId: Id<"skills">) => void;
  onOpenSkills?: () => void;
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const results = useQuery(api.skills.list, { search, category: category || undefined });
  const held = new Set(value.map((s) => s.skillId));
  const candidates = (results?.skills ?? []).filter((s) => !held.has(s._id));

  return (
    <div className="flex flex-col gap-3">
      {value.length > 0 ? (
        <ul className="divide-y divide-hairline border border-hairline">
          {value.map((s) => (
            <li key={s.skillId} className="flex items-center gap-3 px-3 py-1.5 text-sm">
              <span className="min-w-0 flex-1 truncate">{s.name}</span>
              {s.uses !== undefined && (
                <span className="shrink-0 text-[10px] font-mono text-muted" title="Completed runs that used this skill">
                  {s.uses} uses
                  {usesToNext(s.uses, s.level) !== null && ` · ${usesToNext(s.uses, s.level)} to next`}
                </span>
              )}
              <LevelSelect value={s.level} onChange={(l) => onLevel(s.skillId, l)} />
              <button
                type="button"
                onClick={() => onRemove(s.skillId)}
                aria-label={`Remove ${s.name}`}
                className="text-xs font-mono text-muted hover:text-failed"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted">No skills yet.</p>
      )}

      <div>
        <label className={LABEL} htmlFor="skill-search">
          Add a skill
        </label>
        <div className="flex gap-2">
          <input
            id="skill-search"
            className={FIELD}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={results && results.total === 0 ? "The catalogue is empty" : "Search the catalogue…"}
          />
          <select
            aria-label="Category"
            className={`${FIELD} w-40 shrink-0`}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">All categories</option>
            {(results?.categories ?? []).map((c) => (
              <option key={c.name} value={c.name}>
                {c.name || "uncategorised"} ({c.count})
              </option>
            ))}
          </select>
        </div>
        {results && results.total === 0 ? (
          <p className="mt-1 text-xs text-muted">
            Nothing in the catalogue yet.{" "}
            {onOpenSkills && (
              <button type="button" onClick={onOpenSkills} className="underline hover:text-foreground">
                Import or create skills
              </button>
            )}
          </p>
        ) : (
          <ul className="mt-1 max-h-56 overflow-y-auto border border-hairline text-sm">
            {results && (
              <li className="sticky top-0 border-b border-hairline bg-background px-3 py-1 text-[10px] font-mono text-muted">
                {candidates.length} of {results.total} in the catalogue
                {search || category ? " match" : ""}
              </li>
            )}
            {candidates.length === 0 && (
              <li className="px-3 py-1.5 text-xs text-muted">{results ? "No match." : "Loading…"}</li>
            )}
            {candidates.map((s) => (
              <li key={s._id}>
                <button
                  type="button"
                  onClick={() => {
                    onAdd({ skillId: s._id, name: s.name });
                    setSearch("");
                  }}
                  className="flex w-full items-baseline gap-2 px-3 py-1 text-left hover:bg-hairline/50"
                  title={s.description}
                >
                  <span className="truncate">{s.name}</span>
                  <span className="truncate text-[10px] font-mono text-muted">
                    {s.category ?? s.source}
                    {s.verified ? " · verified" : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
