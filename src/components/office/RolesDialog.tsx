"use client";

// Roles dialog: define a role once (title, description, department, which
// role it reports to), then assign people to it from the Employees dialog.
// Roles are grouped by department on the left; the selected one is edited on
// the right. "+ New role" is the last entry, like hiring in Employees.
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/server/convex/_generated/api";
import type { Id } from "@/server/convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import { errorText, FIELD, LABEL } from "./HireForm";
import { formatMetricLine, MEASURE_IDS, MEASURES, parseMetricLine } from "@/lib/metrics";

type Role = FunctionReturnType<typeof api.roles.list>[number];

const splitLines = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);
const parseMetrics = (s: string) => splitLines(s).flatMap((l) => {
  const m = parseMetricLine(l);
  return m ? [m] : [];
});

export function RolesDialog({ onClose }: { onClose: () => void }) {
  const roles = useQuery(api.roles.list) ?? [];
  const seed = useMutation(api.roles.seed);
  const [selectedId, setSelectedId] = useState<Id<"roles"> | "new" | null>(null);
  const [seedNote, setSeedNote] = useState<string | null>(null);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);

  const current: Id<"roles"> | "new" =
    selectedId ?? (roles.length === 0 ? "new" : roles[0]._id);
  const role = current === "new" ? null : (roles.find((r) => r._id === current) ?? null);

  const byDepartment = new Map<string, Role[]>();
  for (const r of roles) {
    const key = r.department ?? "Other";
    byDepartment.set(key, [...(byDepartment.get(key) ?? []), r]);
  }

  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center bg-background/70 p-6 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-label="Roles"
        className="flex h-[min(40rem,92vh)] w-full max-w-4xl flex-col border border-hairline bg-background"
      >
        <header className="relative flex flex-col items-center border-b border-hairline px-6 pt-3 pb-3">
          <h2 className="text-lg font-semibold">Roles</h2>
          <span className="text-xs font-mono text-muted">
            {roles.length === 0 ? "No roles yet" : `${roles.length} roles · ${byDepartment.size} departments`}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-3 text-xs font-mono text-muted hover:underline"
          >
            close
          </button>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-[16rem_minmax(0,1fr)]">
          <nav className="flex min-h-0 flex-col border-r border-hairline" aria-label="Roles by department">
            <div className="min-h-0 flex-1 overflow-y-auto py-2 text-sm">
              {[...byDepartment.entries()].map(([department, list]) => (
                <div key={department} className="mb-2">
                  <div className="px-4 pt-1 text-[10px] font-mono uppercase tracking-wider text-muted">{department}</div>
                  {list.map((r) => (
                    <button
                      key={r._id}
                      type="button"
                      onClick={() => setSelectedId(r._id)}
                      aria-current={current === r._id ? "page" : undefined}
                      className={`flex w-full items-baseline justify-between gap-2 px-4 py-1 text-left ${
                        current === r._id ? "font-semibold text-foreground" : "text-muted hover:text-foreground"
                      }`}
                    >
                      <span className="truncate">{r.roleName}</span>
                      {r.holders.length > 0 && <span className="shrink-0 text-[10px] font-mono">{r.holders.length}</span>}
                    </button>
                  ))}
                </div>
              ))}
            </div>
            <div className="border-t border-hairline px-4 py-2 text-xs font-mono">
              <button
                type="button"
                onClick={async () => {
                  try {
                    const r = await seed({});
                    setSeedNote(
                      r.created.length || r.filled.length
                        ? `Added ${r.created.length} roles, filled duties/metrics on ${r.filled.length}${r.adopted.length ? `; ${r.adopted.join(", ")}` : ""}.`
                        : "The org is already in place."
                    );
                  } catch (e) {
                    setSeedNote(errorText(e));
                  }
                }}
                className="text-muted hover:text-foreground hover:underline"
              >
                Add the org that runs the company
              </button>
              {seedNote && <p className="mt-1 text-muted">{seedNote}</p>}
            </div>
            <button
              type="button"
              onClick={() => setSelectedId("new")}
              aria-current={current === "new" ? "page" : undefined}
              className={`border-t border-hairline px-4 py-2 text-left text-sm ${
                current === "new" ? "font-semibold text-foreground" : "text-muted hover:text-foreground"
              }`}
            >
              + New role
            </button>
          </nav>

          <div className="min-h-0 overflow-y-auto px-6 py-4">
            {role ? (
              <RoleEditor
                key={role._id}
                role={role}
                roles={roles}
                onRemoved={() => setSelectedId(null)}
              />
            ) : (
              <NewRole roles={roles} onCreated={(id) => setSelectedId(id)} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function RoleFields({
  roles,
  self,
  values,
  onChange,
}: {
  roles: Role[];
  self: Id<"roles"> | null;
  values: { roleName: string; roleDescription: string; department: string; supervisorId: string; duties: string; metrics: string };
  onChange: (next: typeof values) => void;
}) {
  const [showMeasures, setShowMeasures] = useState(false);
  const set = (patch: Partial<typeof values>) => onChange({ ...values, ...patch });
  const departments = [...new Set(roles.map((r) => r.department).filter(Boolean))] as string[];
  return (
    <>
      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
        <div>
          <label className={LABEL} htmlFor="role-name">
            Role name (becomes the job title)
          </label>
          <input id="role-name" className={FIELD} value={values.roleName} onChange={(e) => set({ roleName: e.target.value })} placeholder="Receptionist" />
        </div>
        <div>
          <label className={LABEL} htmlFor="role-dept">
            Department
          </label>
          <input
            id="role-dept"
            className={FIELD}
            list="role-departments"
            value={values.department}
            onChange={(e) => set({ department: e.target.value })}
            placeholder="Front desk"
          />
          <datalist id="role-departments">
            {departments.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
        </div>
      </div>
      <div>
        <label className={LABEL} htmlFor="role-desc">
          Role description (a description of the job, not a command)
        </label>
        <textarea
          id="role-desc"
          rows={4}
          className={`${FIELD} resize-y`}
          value={values.roleDescription}
          onChange={(e) => set({ roleDescription: e.target.value })}
        />
      </div>
      <div>
        <label className={LABEL} htmlFor="role-duties">
          Duties (what the holder does on a turn, one per line)
        </label>
        <textarea
          id="role-duties"
          rows={5}
          className={`${FIELD} resize-y`}
          value={values.duties}
          onChange={(e) => set({ duties: e.target.value })}
          placeholder={"Run the staff: check every delegated task is reported back the same day.\nWeekly review: what got done, what slipped, what changes."}
        />
      </div>
      <div>
        <label className={LABEL} htmlFor="role-metrics">
          A successful week, measured (one per line: statement | target unit | measure)
        </label>
        <textarea
          id="role-metrics"
          rows={5}
          className={`${FIELD} resize-y font-mono text-xs`}
          value={values.metrics}
          onChange={(e) => set({ metrics: e.target.value })}
          placeholder={"Every task I delegate is reported back within a day | 100 % | delegations.reported_same_day\nDocuments delivered | 3 count | artifacts.delivered"}
        />
        <button type="button" onClick={() => setShowMeasures((v) => !v)} className="mt-1 text-[10px] font-mono text-muted hover:underline">
          {showMeasures ? "hide measures" : "what can be measured?"}
        </button>
        {showMeasures && (
          <ul className="mt-1 space-y-0.5 text-[10px] text-muted">
            {MEASURE_IDS.map((id) => (
              <li key={id}>
                <span className="font-mono text-foreground">{id}</span> — {MEASURES[id].how}
              </li>
            ))}
            <li>Anything else is not tracked yet: write it down with the measure left blank and it shows as such, never scored by the agent.</li>
          </ul>
        )}
      </div>
      <div>
        <label className={LABEL} htmlFor="role-boss">
          Reports to
        </label>
        <select id="role-boss" className={FIELD} value={values.supervisorId} onChange={(e) => set({ supervisorId: e.target.value })}>
          <option value="">Nobody</option>
          {roles
            .filter((r) => r._id !== self)
            .map((r) => (
              <option key={r._id} value={r._id}>
                {r.roleName}
                {r.department ? ` · ${r.department}` : ""}
              </option>
            ))}
        </select>
      </div>
    </>
  );
}

function NewRole({ roles, onCreated }: { roles: Role[]; onCreated: (id: Id<"roles">) => void }) {
  const create = useMutation(api.roles.create);
  const [values, setValues] = useState({ roleName: "", roleDescription: "", department: "", supervisorId: "", duties: "", metrics: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          const r = await create({
            roleName: values.roleName,
            roleDescription: values.roleDescription,
            department: values.department || undefined,
            supervisorId: values.supervisorId ? (values.supervisorId as Id<"roles">) : undefined,
            duties: splitLines(values.duties),
            metrics: parseMetrics(values.metrics),
          });
          onCreated(r.roleId);
        } catch (err) {
          setError(errorText(err));
        } finally {
          setBusy(false);
        }
      }}
      className="flex flex-col gap-4"
      aria-label="New role"
    >
      <p className="text-xs text-muted">Define the job once. People assigned to it inherit its title, description, duties and metrics.</p>
      <RoleFields roles={roles} self={null} values={values} onChange={setValues} />
      {error && <p className="text-xs font-mono text-failed">{error}</p>}
      <footer className="flex justify-end border-t border-hairline pt-3">
        <button type="submit" disabled={busy} className="border border-foreground px-4 py-1.5 text-sm hover:bg-foreground hover:text-background disabled:opacity-50">
          {busy ? "Creating…" : "Create role"}
        </button>
      </footer>
    </form>
  );
}

function RoleEditor({ role, roles, onRemoved }: { role: Role; roles: Role[]; onRemoved: () => void }) {
  const update = useMutation(api.roles.update);
  const remove = useMutation(api.roles.remove);
  const initial = {
    roleName: role.roleName,
    roleDescription: role.roleDescription,
    department: role.department ?? "",
    supervisorId: role.supervisorId ?? "",
    duties: role.duties.join("\n"),
    metrics: role.metrics.map(formatMetricLine).join("\n"),
  };
  const [values, setValues] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const dirty = JSON.stringify(values) !== JSON.stringify(initial);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await update({
            roleId: role._id,
            roleName: values.roleName,
            roleDescription: values.roleDescription,
            department: values.department,
            supervisorId: values.supervisorId ? (values.supervisorId as Id<"roles">) : "",
            duties: splitLines(values.duties),
            metrics: parseMetrics(values.metrics),
          });
          setSaved(true);
        } catch (err) {
          setError(errorText(err));
        } finally {
          setBusy(false);
        }
      }}
      className="flex flex-col gap-4"
      aria-label={`Edit ${role.roleName}`}
    >
      <RoleFields roles={roles} self={role._id} values={values} onChange={setValues} />
      <div className="text-sm">
        <span className={LABEL}>Held by</span>
        <div className="py-1">{role.holders.length ? role.holders.join(", ") : "Nobody yet"}</div>
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
            <span className="text-failed">Remove the {role.roleName} role?</span>
            <button
              type="button"
              onClick={async () => {
                try {
                  await remove({ roleId: role._id });
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
            disabled={role.holders.length > 0}
            title={role.holders.length > 0 ? "Reassign the people holding this role first" : undefined}
            className="border border-failed px-3 py-1.5 text-sm font-medium text-failed hover:bg-failed hover:text-background disabled:opacity-40"
          >
            Remove role
          </button>
        )}
      </div>
    </form>
  );
}
