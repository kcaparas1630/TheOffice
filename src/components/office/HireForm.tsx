"use client";

// "Hire a new employee": the same profile the terminal wizard collects, plus
// a look chosen from the sprite catalogue. Job descriptions are descriptions,
// not commands; personality shapes tone, never facts.
import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/server/convex/_generated/api";
import type { Id } from "@/server/convex/_generated/dataModel";
import { validateAgentName } from "@/lib/agentName";
import { SPRITE_CATALOG } from "@/lib/office/sprites";
import { LookGrid } from "./LookGrid";
import { SkillPicker, type PickedSkill } from "./SkillPicker";

export const FIELD =
  "w-full border-0 border-b border-hairline bg-transparent py-1 text-sm outline-none focus:border-foreground placeholder:text-muted";
export const LABEL = "block text-[10px] font-mono uppercase tracking-wider text-muted";

export interface RoleOption {
  _id: Id<"roles">;
  roleName: string;
  roleDescription: string;
  department: string | null;
}

export function HireForm({
  roster,
  roles,
  onHired,
  onSpriteChange,
  onOpenRoles,
  onOpenSkills,
}: {
  roster: { name: string; jobTitle: string }[];
  roles: RoleOption[];
  onHired: (name: string) => void;
  onSpriteChange?: (sprite: string) => void;
  onOpenRoles?: () => void;
  onOpenSkills?: () => void;
}) {
  const hire = useMutation(api.agents.hire);
  const [sprite, setSprite] = useState(SPRITE_CATALOG[0].id);
  const [name, setName] = useState("");
  const [roleId, setRoleId] = useState<string>("");
  const role = roles.find((r) => r._id === roleId) ?? null;
  const [successfulDay, setSuccessfulDay] = useState("");
  const [traits, setTraits] = useState("");
  const [notes, setNotes] = useState("");
  const [supervisorName, setSupervisorName] = useState("");
  const [skills, setSkills] = useState<PickedSkill[]>([]);
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
    if (!role) return setError("Pick a role.");
    if (day.length === 0) return setError("Describe at least one item of a successful day.");
    setError(null);
    setBusy(true);
    try {
      const hired = await hire({
        name: name.trim(),
        roleId: role._id,
        successfulDay: day,
        traits: splitCommas(traits),
        notes: notes.trim(),
        supervisorName: supervisorName || undefined,
        sprite,
        skills: skills.map((s) => ({ skillId: s.skillId, level: s.level })),
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
          <label className={LABEL} htmlFor="hire-role">
            Role
          </label>
          <RoleSelect id="hire-role" roles={roles} value={roleId} onChange={setRoleId} />
        </div>
      </div>

      <div>
        <span className={LABEL}>Job description (from the role)</span>
        <p className="py-1 text-sm text-muted">
          {role ? (
            role.roleDescription
          ) : roles.length === 0 ? (
            <>
              No roles yet.{" "}
              {onOpenRoles && (
                <button type="button" onClick={onOpenRoles} className="underline hover:text-foreground">
                  Create one first
                </button>
              )}
            </>
          ) : (
            "Pick a role to see what the job is."
          )}
        </p>
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
        <span className={LABEL}>Skills (from the catalogue, each at a level)</span>
        <div className="mt-2">
          <SkillPicker
            value={skills}
            onAdd={(s) => setSkills((cur) => [...cur, { ...s, level: 1 }])}
            onLevel={(id, level) => setSkills((cur) => cur.map((s) => (s.skillId === id ? { ...s, level } : s)))}
            onRemove={(id) => setSkills((cur) => cur.filter((s) => s.skillId !== id))}
            onOpenSkills={onOpenSkills}
          />
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

// Roles grouped by department; "" = none picked.
export function RoleSelect({
  id,
  roles,
  value,
  onChange,
}: {
  id: string;
  roles: RoleOption[];
  value: string;
  onChange: (roleId: string) => void;
}) {
  const departments = [...new Set(roles.map((r) => r.department ?? "Other"))];
  return (
    <select id={id} className={FIELD} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Pick a role…</option>
      {departments.map((d) => (
        <optgroup key={d} label={d}>
          {roles
            .filter((r) => (r.department ?? "Other") === d)
            .map((r) => (
              <option key={r._id} value={r._id}>
                {r.roleName}
              </option>
            ))}
        </optgroup>
      ))}
    </select>
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
