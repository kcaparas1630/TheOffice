"use client";

// "Hire a new employee": the same profile the terminal wizard collects, plus
// a look chosen from the sprite catalogue. Job descriptions are descriptions,
// not commands; personality shapes tone, never facts.
import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/server/convex/_generated/api";
import { validateAgentName } from "@/lib/agentName";
import { SPRITE_CATALOG, spriteUrl } from "@/lib/office/sprites";

export function HireDialog({
  roster,
  onClose,
  onHired,
}: {
  roster: { name: string; jobTitle: string }[];
  onClose: () => void;
  onHired: (name: string) => void;
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

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nameError = validateAgentName(name);
    if (nameError) return setError(nameError);
    const day = successfulDay
      .split("\n")
      .map((s) => s.replace(/^[-*•]\s*/, "").trim())
      .filter(Boolean);
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
        traits: traits.split(",").map((t) => t.trim()).filter(Boolean),
        notes: notes.trim(),
        supervisorName: supervisorName || undefined,
        sprite,
      });
      onHired(hired.name);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg.match(/Uncaught Error: (.*?)(\n|$)/)?.[1] ?? msg.split("\n")[0]);
      setBusy(false);
    }
  };

  const field =
    "w-full border-0 border-b border-hairline bg-transparent py-1 text-sm outline-none focus:border-foreground placeholder:text-muted";
  const label = "block text-[10px] font-mono uppercase tracking-wider text-muted";

  return (
    <div
      className="fixed inset-0 z-20 flex items-start justify-center overflow-y-auto bg-background/70 p-6 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <form
        onSubmit={submit}
        className="w-full max-w-xl border border-hairline bg-background px-6 py-5"
        aria-label="Hire a new employee"
      >
        <header className="flex items-baseline justify-between border-b border-hairline pb-3">
          <h2 className="text-base font-semibold">Hire a new employee</h2>
          <button type="button" onClick={onClose} className="text-xs font-mono text-muted hover:underline">
            cancel
          </button>
        </header>

        <section className="mt-4">
          <span className={label}>Look</span>
          <div className="mt-2 flex flex-wrap gap-3">
            {SPRITE_CATALOG.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSprite(s.id)}
                aria-pressed={sprite === s.id}
                className={`flex flex-col items-center gap-1 border px-3 pt-2 pb-1 text-xs ${
                  sprite === s.id ? "border-foreground" : "border-hairline text-muted hover:border-muted"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- pixel art, no optimization wanted */}
                <img
                  src={spriteUrl(s.id, "front")}
                  alt={s.label}
                  width={40}
                  height={80}
                  style={{ imageRendering: "auto" }}
                />
                {s.label}
              </button>
            ))}
          </div>
        </section>

        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4">
          <div>
            <label className={label} htmlFor="hire-name">
              Name (their @handle)
            </label>
            <input id="hire-name" className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Edna" autoFocus />
          </div>
          <div>
            <label className={label} htmlFor="hire-title">
              Job title
            </label>
            <input id="hire-title" className={field} value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="CTO" />
          </div>
        </div>

        <div className="mt-4">
          <label className={label} htmlFor="hire-desc">
            Job description (a real description of the role, not a command)
          </label>
          <textarea id="hire-desc" rows={3} className={`${field} resize-y`} value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} />
        </div>

        <div className="mt-4">
          <label className={label} htmlFor="hire-day">
            A successful day would be… (one item per line)
          </label>
          <textarea id="hire-day" rows={3} className={`${field} resize-y`} value={successfulDay} onChange={(e) => setSuccessfulDay(e.target.value)} placeholder={"Report to the CEO with a brief\nFilter relevant tech news"} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4">
          <div>
            <label className={label} htmlFor="hire-traits">
              Personality traits (comma-separated)
            </label>
            <input id="hire-traits" className={field} value={traits} onChange={(e) => setTraits(e.target.value)} placeholder="jolly, optimistic" />
          </div>
          <div>
            <label className={label} htmlFor="hire-boss">
              Reports to
            </label>
            <select id="hire-boss" className={field} value={supervisorName} onChange={(e) => setSupervisorName(e.target.value)}>
              <option value="">Nobody</option>
              {roster.map((a) => (
                <option key={a.name} value={a.name}>
                  {a.name} · {a.jobTitle}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4">
          <label className={label} htmlFor="hire-notes">
            Anything else about who they are (optional)
          </label>
          <input id="hire-notes" className={field} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        {error && <p className="mt-4 text-xs font-mono text-failed">{error}</p>}

        <footer className="mt-5 flex items-center justify-end gap-4 border-t border-hairline pt-3">
          <button type="submit" disabled={busy} className="border border-foreground px-4 py-1.5 text-sm hover:bg-foreground hover:text-background disabled:opacity-50">
            {busy ? "Hiring…" : "Hire"}
          </button>
        </footer>
      </form>
    </div>
  );
}
