"use client";

// Skills dialog: the central catalogue. Search it, import a slice of the
// Smithery registry, add a custom skill, edit or remove one. Who holds a
// skill (and at what level) is shown but assigned from the Employees dialog.
import { useEffect, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/server/convex/_generated/api";
import type { Id } from "@/server/convex/_generated/dataModel";
import { LEVEL_LABELS } from "@/lib/skills";
import { errorText, FIELD, LABEL } from "./HireForm";

export function SkillsDialog({ onClose }: { onClose: () => void }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const list = useQuery(api.skills.list, { search, category: category || undefined });
  const seedCatalogue = useMutation(api.skills.seed);
  const [selectedId, setSelectedId] = useState<Id<"skills"> | "new" | null>(null);
  const importSkills = useAction(api.skills.importFromSmithery);
  const [importing, setImporting] = useState(false);
  const [importNote, setImportNote] = useState<string | null>(null);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);

  const skills = list?.skills ?? [];
  const current: Id<"skills"> | "new" = selectedId ?? (skills.length === 0 ? "new" : skills[0]._id);

  const runSeed = async () => {
    setImporting(true);
    setImportNote(null);
    try {
      const r = await seedCatalogue({});
      setImportNote(`Office catalogue: ${r.created} new, ${r.updated} refreshed.`);
    } catch (e) {
      setImportNote(errorText(e));
    } finally {
      setImporting(false);
    }
  };

  const runImport = async () => {
    setImporting(true);
    setImportNote(null);
    try {
      const r = await importSkills({ pages: 3, verifiedOnly: true, query: search || undefined });
      setImportNote(`Fetched ${r.fetched}: ${r.created} new, ${r.updated} updated.`);
    } catch (e) {
      setImportNote(errorText(e));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center bg-background/70 p-6 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-label="Skills"
        className="flex h-[min(42rem,92vh)] w-full max-w-5xl flex-col border border-hairline bg-background"
      >
        <header className="relative flex flex-col items-center border-b border-hairline px-6 pt-3 pb-3">
          <h2 className="text-lg font-semibold">Skills</h2>
          <span className="text-xs font-mono text-muted">
            {list
              ? `${list.total} in the catalogue${search || category ? ` · ${list.matched} shown` : ""}`
              : "Loading…"}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-3 text-xs font-mono text-muted hover:underline"
          >
            close
          </button>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-[20rem_minmax(0,1fr)]">
          <nav className="flex min-h-0 flex-col border-r border-hairline" aria-label="Catalogue">
            <div className="border-b border-hairline px-3 py-2">
              <input
                aria-label="Search skills"
                className={FIELD}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, category, description…"
              />
              <select
                aria-label="Category"
                className={`${FIELD} mt-2`}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">All categories{list ? ` (${list.total})` : ""}</option>
                {(list?.categories ?? []).map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name || "uncategorised"} ({c.count})
                  </option>
                ))}
              </select>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto py-1 text-sm">
              {skills.map((s) => (
                <button
                  key={s._id}
                  type="button"
                  onClick={() => setSelectedId(s._id)}
                  aria-current={current === s._id ? "page" : undefined}
                  className={`flex w-full flex-col px-4 py-1.5 text-left ${
                    current === s._id ? "bg-hairline/40 text-foreground" : "text-muted hover:text-foreground"
                  }`}
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className={`truncate ${current === s._id ? "font-semibold" : ""}`}>{s.name}</span>
                    {s.holders.length > 0 && <span className="shrink-0 text-[10px] font-mono">{s.holders.length}</span>}
                  </span>
                  <span className="truncate text-[10px] font-mono">
                    {s.category ?? "uncategorised"} · {s.source}
                    {s.verified ? " · verified" : ""}
                  </span>
                </button>
              ))}
              {list && skills.length === 0 && <p className="px-4 py-2 text-xs text-muted">Nothing here yet.</p>}
            </div>
            <div className="flex flex-col gap-1 border-t border-hairline px-4 py-2 text-xs font-mono">
              <button
                type="button"
                onClick={runSeed}
                disabled={importing}
                className="text-left text-muted hover:text-foreground hover:underline disabled:opacity-50"
                title="The office's own catalogue: work and life skills across finance, planning, social, emotional, research, coding, operations and more. Safe to re-run."
              >
                {importing ? "Working…" : "Add the office catalogue (all sectors)"}
              </button>
              <button
                type="button"
                onClick={runImport}
                disabled={importing}
                className="text-muted hover:text-foreground hover:underline disabled:opacity-50"
                title="Verified skills from Smithery's registry (up to 300); with a search term, the matching ones"
              >
                {importing ? "Importing…" : search ? `Import "${search}" from Smithery` : "Import from Smithery"}
              </button>
              {importNote && <p className="mt-1 text-muted">{importNote}</p>}
            </div>
            <button
              type="button"
              onClick={() => setSelectedId("new")}
              aria-current={current === "new" ? "page" : undefined}
              className={`border-t border-hairline px-4 py-2 text-left text-sm ${
                current === "new" ? "font-semibold text-foreground" : "text-muted hover:text-foreground"
              }`}
            >
              + New skill
            </button>
          </nav>

          <div className="min-h-0 overflow-y-auto px-6 py-4">
            {current === "new" ? (
              <NewSkill onCreated={(id) => setSelectedId(id)} />
            ) : (
              <SkillEditor key={current} skillId={current} onRemoved={() => setSelectedId(null)} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function NewSkill({ onCreated }: { onCreated: (id: Id<"skills">) => void }) {
  const create = useMutation(api.skills.create);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      aria-label="New skill"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          const r = await create({ name, description, category: category || undefined, prompt: prompt || undefined });
          onCreated(r.skillId);
        } catch (err) {
          setError(errorText(err));
        } finally {
          setBusy(false);
        }
      }}
      className="flex flex-col gap-4"
    >
      <p className="text-xs text-muted">
        A skill is knowledge (instructions the agent reads) plus, later, tools from the repo. Nothing typed here runs.
      </p>
      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
        <div>
          <label className={LABEL} htmlFor="skill-name">
            Name
          </label>
          <input id="skill-name" className={FIELD} value={name} onChange={(e) => setName(e.target.value)} placeholder="Deck building (PPTX)" />
        </div>
        <div>
          <label className={LABEL} htmlFor="skill-category">
            Category
          </label>
          <input id="skill-category" className={FIELD} value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Documents" />
        </div>
      </div>
      <div>
        <label className={LABEL} htmlFor="skill-desc">
          Description
        </label>
        <textarea id="skill-desc" rows={3} className={`${FIELD} resize-y`} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div>
        <label className={LABEL} htmlFor="skill-prompt">
          Instructions (optional, SKILL.md style — goes into the agent&apos;s prompt)
        </label>
        <textarea id="skill-prompt" rows={6} className={`${FIELD} resize-y font-mono text-xs`} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
      </div>
      {error && <p className="text-xs font-mono text-failed">{error}</p>}
      <footer className="flex justify-end border-t border-hairline pt-3">
        <button type="submit" disabled={busy} className="border border-foreground px-4 py-1.5 text-sm hover:bg-foreground hover:text-background disabled:opacity-50">
          {busy ? "Creating…" : "Create skill"}
        </button>
      </footer>
    </form>
  );
}

function SkillEditor({ skillId, onRemoved }: { skillId: Id<"skills">; onRemoved: () => void }) {
  const skill = useQuery(api.skills.get, { skillId });
  const update = useMutation(api.skills.update);
  const remove = useMutation(api.skills.remove);
  const [draft, setDraft] = useState<{ name: string; description: string; category: string; prompt: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  if (!skill) return <p className="text-xs text-muted">Loading…</p>;
  const initial = {
    name: skill.name,
    description: skill.description,
    category: skill.category ?? "",
    prompt: skill.prompt ?? "",
  };
  const values = draft ?? initial;
  const dirty = JSON.stringify(values) !== JSON.stringify(initial);
  const set = (patch: Partial<typeof values>) => setDraft({ ...values, ...patch });

  return (
    <form
      aria-label={`Edit ${skill.name}`}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await update({ skillId, ...values });
          setDraft(null);
          setSaved(true);
        } catch (err) {
          setError(errorText(err));
        } finally {
          setBusy(false);
        }
      }}
      className="flex flex-col gap-4"
    >
      <div className="text-[11px] font-mono text-muted">
        {skill.slug} · {skill.source}
        {skill.verified ? " · verified" : ""}
        {skill.popularity > 0 ? ` · ${skill.popularity} activations` : ""}
        {skill.sourceUrl && (
          <>
            {" · "}
            <a href={skill.sourceUrl} target="_blank" rel="noreferrer" className="underline hover:text-foreground">
              source
            </a>
          </>
        )}
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
        <div>
          <label className={LABEL} htmlFor="edit-skill-name">
            Name
          </label>
          <input id="edit-skill-name" className={FIELD} value={values.name} onChange={(e) => set({ name: e.target.value })} />
        </div>
        <div>
          <label className={LABEL} htmlFor="edit-skill-category">
            Category
          </label>
          <input id="edit-skill-category" className={FIELD} value={values.category} onChange={(e) => set({ category: e.target.value })} />
        </div>
      </div>
      <div>
        <label className={LABEL} htmlFor="edit-skill-desc">
          Description
        </label>
        <textarea id="edit-skill-desc" rows={3} className={`${FIELD} resize-y`} value={values.description} onChange={(e) => set({ description: e.target.value })} />
      </div>
      <div>
        <button type="button" onClick={() => setShowPrompt((s) => !s)} className={`${LABEL} hover:text-foreground`}>
          Instructions {values.prompt ? `(${values.prompt.length} chars)` : "(none)"} {showPrompt ? "▴" : "▾"}
        </button>
        {showPrompt && (
          <textarea
            aria-label="Instructions"
            rows={12}
            className={`${FIELD} resize-y font-mono text-xs`}
            value={values.prompt}
            onChange={(e) => set({ prompt: e.target.value })}
          />
        )}
      </div>
      <div className="text-sm">
        <span className={LABEL}>Held by</span>
        <div className="py-1">
          {skill.holderLevels.length
            ? skill.holderLevels.map((h) => `${h.name} (${h.level} · ${LEVEL_LABELS[h.level]}, ${h.uses} uses)`).join(", ")
            : "Nobody yet — assign it from Employees → Skills."}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-hairline pt-3 text-xs font-mono">
        <span className={error ? "text-failed" : "text-muted"}>{error ?? (saved && !dirty ? "Saved." : "")}</span>
        <button
          type="submit"
          disabled={!dirty || busy}
          className="border border-foreground px-3 py-1 text-sm hover:bg-foreground hover:text-background disabled:opacity-40"
        >
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
      <div className="mt-4 border-t border-hairline pt-3 text-xs">
        {confirming ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-failed">Remove {skill.name} from the catalogue?</span>
            <button
              type="button"
              onClick={async () => {
                try {
                  await remove({ skillId });
                  onRemoved();
                } catch (err) {
                  setError(errorText(err));
                  setConfirming(false);
                }
              }}
              className="border border-failed bg-failed px-3 py-1 text-sm font-medium text-background hover:opacity-90"
            >
              Yes, remove it
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="border border-hairline px-3 py-1 text-sm text-muted hover:text-foreground">
              Keep it
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={skill.holders.length > 0}
            title={skill.holders.length > 0 ? "Remove it from the people holding it first" : undefined}
            className="border border-failed px-3 py-1.5 text-sm font-medium text-failed hover:bg-failed hover:text-background disabled:opacity-40"
          >
            Remove skill
          </button>
        )}
      </div>
    </form>
  );
}
