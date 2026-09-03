"use client";

// "Hire a new employee": the same profile the terminal wizard collects, plus
// a look chosen from the sprite catalogue. Job descriptions are descriptions,
// not commands; personality shapes tone, never facts.
import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/server/convex/_generated/api";
import { validateAgentName } from "@/lib/agentName";
import { SPRITE_CATALOG } from "@/lib/office/sprites";
import { LookGrid } from "./LookGrid";

export const FIELD =
  "w-full border-0 border-b border-hairline bg-transparent py-1 text-sm outline-none focus:border-foreground placeholder:text-muted";
export const LABEL = "block text-[10px] font-mono uppercase tracking-wider text-muted";

export function HireForm({
  roster,
  onHired,
  onSpriteChange,
}: {
  roster: { name: string; jobTitle: string }[];
  onHired: (name: string) => void;
  onSpriteChange?: (sprite: string) => void;
}) {
  const hire = useMutation(api.agents.hire);
  const [sprite, setSprite] = useState(SPRITE_CATALOG[0].id);
  const [name, setName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [successfulDay, setSuccessfulDay] = useState("");
  const [traits, setTraits] = useState("");
  const [notes, setNotes] = useState("");
  const [supervisorName, setSupervisorName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const chooseSprite = (id: string) => {
    setSprite(id);
    onSpriteChange?.(id);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nameError = validateAgentName(name);
    if (nameError) return setError(nameError);
    const day = splitLines(successfulDay);
    if (!jobTitle.trim()) return setError("Job title is required.");
    if (!jobDescription.trim()) return setError("Job description is required.");
    if (day.length === 0) return setError("Describe at least one item of a successful day.");
    setError(null);
    setBusy(true);
    try {
      const hired = await hire({
        name: name.trim(),
        jobTitle: jobTitle.trim(),
        jobDescription: jobDescription.trim(),
        successfulDay: day,
        traits: splitCommas(traits),
        notes: notes.trim(),
        supervisorName: supervisorName || undefined,
        sprite,
      });
      onHired(hired.name);
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} aria-label="Hire a new employee" className="flex flex-col gap-4">
      <section>
        <span className={LABEL}>Look</span>
        <div className="mt-2">
          <LookGrid value={sprite} onChange={chooseSprite} size={32} />
        </div>
      </section>

      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
        <div>
          <label className={LABEL} htmlFor="hire-name">
            Name (their @handle)
          </label>
          <input id="hire-name" className={FIELD} value={name} onChange={(e) => setName(e.target.value)} placeholder="Edna" autoFocus />
        </div>
        <div>
          <label className={LABEL} htmlFor="hire-title">
            Job title
          </label>
          <input id="hire-title" className={FIELD} value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="CTO" />
        </div>
      </div>

      <div>
        <label className={LABEL} htmlFor="hire-desc">
          Job description (a real description of the role, not a command)
        </label>
        <textarea id="hire-desc" rows={3} className={`${FIELD} resize-y`} value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} />
      </div>

      <div>
        <label className={LABEL} htmlFor="hire-day">
          A successful day would be… (one item per line)
        </label>
        <textarea
          id="hire-day"
          rows={3}
          className={`${FIELD} resize-y`}
          value={successfulDay}
          onChange={(e) => setSuccessfulDay(e.target.value)}
          placeholder={"Report to the CEO with a brief\nFilter relevant tech news"}
        />
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
        <div>
          <label className={LABEL} htmlFor="hire-traits">
            Personality traits (comma-separated)
          </label>
          <input id="hire-traits" className={FIELD} value={traits} onChange={(e) => setTraits(e.target.value)} placeholder="jolly, optimistic" />
        </div>
        <div>
          <label className={LABEL} htmlFor="hire-boss">
            Reports to
          </label>
          <select id="hire-boss" className={FIELD} value={supervisorName} onChange={(e) => setSupervisorName(e.target.value)}>
            <option value="">Nobody</option>
            {roster.map((a) => (
              <option key={a.name} value={a.name}>
                {a.name} · {a.jobTitle}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={LABEL} htmlFor="hire-notes">
          Anything else about who they are (optional)
        </label>
        <input id="hire-notes" className={FIELD} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      {error && <p className="text-xs font-mono text-failed">{error}</p>}

      <footer className="flex items-center justify-end border-t border-hairline pt-3">
        <button type="submit" disabled={busy} className="border border-foreground px-4 py-1.5 text-sm hover:bg-foreground hover:text-background disabled:opacity-50">
          {busy ? "Hiring…" : "Hire"}
        </button>
      </footer>
    </form>
  );
}

export const splitLines = (text: string) =>
  text
    .split("\n")
    .map((s) => s.replace(/^[-*•]\s*/, "").trim())
    .filter(Boolean);

export const splitCommas = (text: string) =>
  text
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

export function errorText(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  return msg.match(/Uncaught Error: (.*?)(\n|$)/)?.[1] ?? msg.split("\n")[0];
}
