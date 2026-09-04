"use client";

// The Employees dialog: everything about one person at a time. Arrows at the
// top switch employees; tabs on the left pick a section (profile, job,
// personality, look, or hiring someone new); the right half shows them.
// Edits go through `agents.update`; hiring and firing through their own
// mutations. Only records are shown — nothing here is inferred from prose.
import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/server/convex/_generated/api";
import type { Snapshot } from "./OfficeCanvas";
import type { Id } from "@/server/convex/_generated/dataModel";
import { defaultSpriteFor, isSpriteId, SPRITE_CATALOG, spriteUrl } from "@/lib/office/sprites";
import { timeAgo } from "@/lib/time";
import { errorText, FIELD, HireForm, LABEL, RoleSelect, splitCommas, splitLines } from "./HireForm";
import { LookGrid } from "./LookGrid";
import { SkillPicker } from "./SkillPicker";

export type EmployeesTab = "profile" | "job" | "personality" | "skills" | "look" | "hire";

type Agent = Snapshot["agents"][number];
type Job = Snapshot["jobs"][number];
type Role = Snapshot["roles"][number];

const TABS: { id: EmployeesTab; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "job", label: "Job" },
  { id: "personality", label: "Personality" },
  { id: "skills", label: "Skills" },
  { id: "look", label: "Look" },
];

export function EmployeesDialog({
  roster,
  jobs,
  roles,
  now,
  initialName,
  initialTab = "profile",
  onClose,
  onSelectName,
  onOpenRoles,
  onOpenSkills,
}: {
  roster: Agent[];
  jobs: Job[];
  roles: Role[];
  now: number;
  initialName: string | null;
  initialTab?: EmployeesTab;
  onClose: () => void;
  onSelectName: (name: string) => void;
  onOpenRoles?: () => void;
  onOpenSkills?: () => void;
}) {
  const [name, setName] = useState<string | null>(initialName);
  const [tab, setTab] = useState<EmployeesTab>(roster.length === 0 ? "hire" : initialTab);
  const [hireSprite, setHireSprite] = useState(SPRITE_CATALOG[0].id);

  const index = roster.findIndex((a) => a.name === name);
  const agent = index >= 0 ? roster[index] : (roster[0] ?? null);
  const hiring = tab === "hire" || !agent;

  const goto = (delta: number) => {
    if (roster.length === 0) return;
    const i = ((index < 0 ? 0 : index) + delta + roster.length) % roster.length;
    setName(roster[i].name);
    onSelectName(roster[i].name);
    if (tab === "hire") setTab("profile");
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return onClose();
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if (e.key === "ArrowLeft") goto(-1);
      if (e.key === "ArrowRight") goto(1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  const shownSprite = hiring
    ? hireSprite
    : agent?.sprite && isSpriteId(agent.sprite)
      ? agent.sprite
      : defaultSpriteFor(agent?.name ?? "");
  const shownLabel = SPRITE_CATALOG.find((s) => s.id === shownSprite)?.label ?? shownSprite;

  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center bg-background/70 p-6 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-label="Employees"
        className="flex h-[min(44rem,92vh)] w-full max-w-5xl flex-col border border-hairline bg-background"
      >
        <header className="relative flex flex-col items-center border-b border-hairline px-6 pt-3 pb-3">
          <div className="flex items-center gap-8 font-mono text-lg">
            <button
              type="button"
              aria-label="Previous employee"
              onClick={() => goto(-1)}
              disabled={roster.length < 2 && !hiring}
              className="px-2 text-muted hover:text-foreground disabled:opacity-30"
            >
              ←
            </button>
            <button
              type="button"
              aria-label="Next employee"
              onClick={() => goto(1)}
              disabled={roster.length < 2 && !hiring}
              className="px-2 text-muted hover:text-foreground disabled:opacity-30"
            >
              →
            </button>
          </div>
          <h2 className="mt-1 text-lg font-semibold">{hiring ? "New hire" : agent!.name}</h2>
          <span className="text-xs font-mono text-muted">
            {hiring
              ? roster.length === 0
                ? "The office is empty"
                : `${roster.length} people`
              : `${agent!.jobTitle} · ${index + 1} of ${roster.length}`}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-3 text-xs font-mono text-muted hover:underline"
          >
            close
          </button>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-2">
          <div className="flex min-h-0 border-r border-hairline">
            <nav className="flex w-40 shrink-0 flex-col border-r border-hairline py-3 text-sm" aria-label="Sections">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  disabled={!agent}
                  aria-current={tab === t.id && !hiring ? "page" : undefined}
                  className={`px-4 py-1.5 text-left disabled:opacity-40 ${
                    tab === t.id && !hiring ? "font-semibold text-foreground" : "text-muted hover:text-foreground"
                  }`}
                >
                  {t.label}
                </button>
              ))}
              {agent && (
                <FireButton
                  key={agent._id}
                  agent={agent}
                  onFired={() => {
                    const rest = roster.filter((a) => a._id !== agent._id);
                    setName(rest[0]?.name ?? null);
                    if (rest.length === 0) setTab("hire");
                  }}
                />
              )}
              <button
                type="button"
                onClick={() => setTab("hire")}
                aria-current={hiring ? "page" : undefined}
                className={`border-t border-hairline px-4 py-2 text-left ${
                  hiring ? "font-semibold text-foreground" : "text-muted hover:text-foreground"
                }`}
              >
                + Hire a new employee
              </button>
            </nav>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {hiring ? (
                <HireForm
                  roster={roster}
                  roles={roles}
                  onOpenRoles={onOpenRoles}
                  onOpenSkills={onOpenSkills}
                  onSpriteChange={setHireSprite}
                  onHired={(hired) => {
                    setName(hired);
                    onSelectName(hired);
                    setTab("profile");
                  }}
                />
              ) : tab === "profile" ? (
                <ProfilePanel key={agent!._id} agent={agent!} roster={roster} roles={roles} now={now} />
              ) : tab === "job" ? (
                <JobPanel key={agent!._id} agent={agent!} jobs={jobs.filter((j) => j.agentId === agent!._id)} />
              ) : tab === "personality" ? (
                <PersonalityPanel key={agent!._id} agent={agent!} />
              ) : tab === "skills" ? (
                <SkillsPanel key={agent!._id} agent={agent!} onOpenSkills={onOpenSkills} />
              ) : (
                <LookPanel key={agent!._id} agent={agent!} />
              )}
            </div>
          </div>

          <figure className="flex min-h-0 flex-col items-center justify-center gap-3 p-6">
            {/* eslint-disable-next-line @next/next/no-img-element -- pixel art */}
            <img
              src={spriteUrl(shownSprite, "front")}
              alt={`${hiring ? "New hire" : agent!.name} — ${shownLabel}`}
              className="max-h-[70%] w-auto object-contain"
            />
            <figcaption className="text-center text-xs font-mono text-muted">
              {shownLabel}
              {!hiring && !agent!.sprite && " (auto)"}
              {!hiring && (
                <div className="mt-1">
                  <span
                    className={`mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle ${
                      agent!.status === "working" ? "bg-working animate-pulse" : "bg-hairline"
                    }`}
                  />
                  {agent!.status}
                </div>
              )}
            </figcaption>
          </figure>
        </div>
      </div>
    </div>
  );
}

function SaveRow({ dirty, busy, error, saved }: { dirty: boolean; busy: boolean; error: string | null; saved: boolean }) {
  return (
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
  );
}

function useSave() {
  const update = useMutation(api.agents.update);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const save = async (args: Parameters<typeof update>[0]) => {
    setBusy(true);
    setError(null);
    try {
      await update(args);
      setSaved(true);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return { save, busy, error, saved };
}

function ProfilePanel({ agent, roster, roles, now }: { agent: Agent; roster: Agent[]; roles: Role[]; now: number }) {
  const [roleId, setRoleId] = useState<string>(agent.roleId ?? "");
  const [supervisorName, setSupervisorName] = useState(agent.supervisorName ?? "");
  const { save, busy, error, saved } = useSave();
  const dirty = roleId !== (agent.roleId ?? "") || supervisorName !== (agent.supervisorName ?? "");
  const reports = roster.filter((a) => a.supervisorId === agent._id);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save({ name: agent.name, supervisorName, ...(roleId && roleId !== agent.roleId ? { roleId: roleId as Id<"roles"> } : {}) });
      }}
      className="flex flex-col gap-4"
    >
      <div>
        <span className={LABEL}>Name (their @handle)</span>
        <div className="py-1 text-sm">@{agent.name}</div>
      </div>
      <div>
        <label className={LABEL} htmlFor="emp-role">
          Role
        </label>
        {roles.length > 0 ? (
          <RoleSelect id="emp-role" roles={roles} value={roleId} onChange={setRoleId} />
        ) : (
          <div className="py-1 text-sm">{agent.jobTitle}</div>
        )}
        {!agent.roleId && roles.length > 0 && (
          <p className="mt-1 text-[11px] text-muted">Currently a hand-typed title: {agent.jobTitle}. Pick a role to replace it.</p>
        )}
      </div>
      <div>
        <label className={LABEL} htmlFor="emp-boss">
          Reports to
        </label>
        <select id="emp-boss" className={FIELD} value={supervisorName} onChange={(e) => setSupervisorName(e.target.value)}>
          <option value="">Nobody</option>
          {roster
            .filter((a) => a._id !== agent._id)
            .map((a) => (
              <option key={a._id} value={a.name}>
                {a.name} · {a.jobTitle}
              </option>
            ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-x-6 text-sm">
        <div>
          <span className={LABEL}>Team</span>
          <div className="py-1">{reports.length ? reports.map((r) => r.name).join(", ") : "No direct reports"}</div>
        </div>
        <div>
          <span className={LABEL}>Hired</span>
          <div className="py-1">{timeAgo(agent.hiredAt, now)}</div>
        </div>
      </div>
      <SaveRow dirty={dirty} busy={busy} error={error} saved={saved} />

    </form>
  );
}

function FireButton({ agent, onFired }: { agent: Agent; onFired: () => void }) {
  const fire = useMutation(api.agents.fire);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!confirming) {
    return (
      <div className="mt-auto border-t border-hairline px-4 py-3">
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="w-full border border-failed px-3 py-1.5 text-sm font-medium text-failed hover:bg-failed hover:text-background"
        >
          Fire {agent.name}
        </button>
      </div>
    );
  }
  return (
    <div className="mt-auto border-t border-hairline px-4 py-3 text-xs">
      <p className="text-failed">Fire {agent.name}? Their jobs, runs and documents go too.</p>
      <div className="mt-2 flex flex-col gap-1.5">
        <button
          type="button"
          onClick={async () => {
            try {
              await fire({ name: agent.name });
              onFired();
            } catch (e) {
              setError(errorText(e));
            }
          }}
          className="w-full border border-failed bg-failed px-3 py-1.5 text-sm font-medium text-background hover:opacity-90"
        >
          Yes, fire {agent.name}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="w-full border border-hairline px-3 py-1 text-sm text-muted hover:border-foreground hover:text-foreground"
        >
          Keep them
        </button>
      </div>
      {error && <p className="mt-1 text-failed">{error}</p>}
    </div>
  );
}

function JobPanel({ agent, jobs }: { agent: Agent; jobs: Job[] }) {
  const [jobDescription, setJobDescription] = useState(agent.jobDescription);
  const [successfulDay, setSuccessfulDay] = useState(agent.successfulDay.join("\n"));
  const { save, busy, error, saved } = useSave();
  const dirty =
    jobDescription !== agent.jobDescription || splitLines(successfulDay).join("\n") !== agent.successfulDay.join("\n");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save({ name: agent.name, successfulDay: splitLines(successfulDay), ...(agent.roleId ? {} : { jobDescription }) });
      }}
      className="flex flex-col gap-4"
    >
      <div>
        <label className={LABEL} htmlFor="emp-desc">
          Job description {agent.roleId ? `(from the ${agent.jobTitle} role)` : "(a description, not a command)"}
        </label>
        {agent.roleId ? (
          <p id="emp-desc" className="py-1 text-sm text-muted">{agent.jobDescription}</p>
        ) : (
          <textarea id="emp-desc" rows={4} className={`${FIELD} resize-y`} value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} />
        )}
      </div>
      <div>
        <label className={LABEL} htmlFor="emp-day">
          A successful day would be… (one item per line)
        </label>
        <textarea id="emp-day" rows={4} className={`${FIELD} resize-y`} value={successfulDay} onChange={(e) => setSuccessfulDay(e.target.value)} />
      </div>
      <SaveRow dirty={dirty} busy={busy} error={error} saved={saved} />

      <section className="mt-4 text-sm">
        <span className={LABEL}>Standing jobs</span>
        {jobs.length === 0 ? (
          <p className="mt-1 text-muted">
            None yet. Give them one in the terminal: <code className="font-mono">/assign {agent.name}</code>
          </p>
        ) : (
          <ul className="mt-1 space-y-2">
            {jobs.map((j) => (
              <li key={j._id} className="border-l-2 border-hairline pl-2">
                <div>
                  {j.title}
                  {!j.active && <span className="ml-2 text-xs text-muted">(paused)</span>}
                </div>
                <div className="text-xs font-mono text-muted">
                  {j.schedule} · {j.feeds.length ? `${j.feeds.length} sources: ${j.feeds.join(", ")}` : "office default sources"}
                  {j.lessons.length > 0 && ` · ${j.lessons.length} lesson${j.lessons.length === 1 ? "" : "s"} learned`}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </form>
  );
}

function PersonalityPanel({ agent }: { agent: Agent }) {
  const [traits, setTraits] = useState(agent.traits.join(", "));
  const [notes, setNotes] = useState(agent.notes);
  const { save, busy, error, saved } = useSave();
  const dirty = splitCommas(traits).join(",").toLowerCase() !== agent.traits.join(",") || notes !== agent.notes;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save({ name: agent.name, traits: splitCommas(traits), notes });
      }}
      className="flex flex-col gap-4"
    >
      <p className="text-xs text-muted">Personality shapes tone, never facts. Answers still come from real work state.</p>
      <div>
        <label className={LABEL} htmlFor="emp-traits">
          Traits (comma-separated)
        </label>
        <input id="emp-traits" className={FIELD} value={traits} onChange={(e) => setTraits(e.target.value)} placeholder="jolly, optimistic" />
      </div>
      <div>
        <label className={LABEL} htmlFor="emp-notes">
          How they carry themselves
        </label>
        <textarea id="emp-notes" rows={4} className={`${FIELD} resize-y`} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <SaveRow dirty={dirty} busy={busy} error={error} saved={saved} />
    </form>
  );
}

function LookPanel({ agent }: { agent: Agent }) {
  const setSprite = useMutation(api.agents.setSprite);
  const [error, setError] = useState<string | null>(null);
  const choose = async (sprite: string | undefined) => {
    setError(null);
    try {
      await setSprite({ name: agent.name, sprite });
    } catch (e) {
      setError(errorText(e));
    }
  };
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted">Pick how {agent.name} looks in the office. Changes show up immediately.</p>
      <LookGrid value={agent.sprite} onChange={choose} size={36} />
      <div className="flex items-center justify-between text-xs font-mono">
        <button type="button" onClick={() => choose(undefined)} className="text-muted hover:underline">
          let the office pick
        </button>
        {error && <span className="text-failed">{error}</span>}
      </div>
    </div>
  );
}

// Skills the person holds, each at a level; changes save immediately.
function SkillsPanel({ agent, onOpenSkills }: { agent: Agent; onOpenSkills?: () => void }) {
  const assign = useMutation(api.skills.assign);
  const unassign = useMutation(api.skills.unassign);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errorText(e));
    }
  };
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted">
        Levels rise on their own with completed runs that used the skill (50 uses to reach 2, then 150, 450, 950) and can
        be set by hand. {agent.name} only claims skills listed here.
      </p>
      <SkillPicker
        value={agent.skills.map((s) => ({ skillId: s.skillId, name: s.name, level: s.level, uses: s.uses }))}
        onAdd={(s) => run(() => assign({ agentName: agent.name, skillId: s.skillId, level: 1 }))}
        onLevel={(skillId, level) => run(() => assign({ agentName: agent.name, skillId, level }))}
        onRemove={(skillId) => run(() => unassign({ agentName: agent.name, skillId }))}
        onOpenSkills={onOpenSkills}
      />
      {error && <p className="text-xs font-mono text-failed">{error}</p>}
    </div>
  );
}
