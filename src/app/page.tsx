"use client";

// Two panes, per the spec: [Office] | [Chat]. Everything on screen is a
// reactive view of the same Convex records the terminal uses.
import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/server/convex/_generated/api";
import { OfficeCanvas } from "@/components/office/OfficeCanvas";
import { ActivityStrip } from "@/components/office/ActivityStrip";
import { OfficeMenu } from "@/components/office/OfficeMenu";
import { EmployeesDialog, type EmployeesTab } from "@/components/office/EmployeesDialog";
import { RolesDialog } from "@/components/office/RolesDialog";
import { SkillsDialog } from "@/components/office/SkillsDialog";
import { ChatPane, type PaneView } from "@/components/chat/ChatPane";

export default function Home() {
  const snapshot = useQuery(api.office.snapshot);
  const [chosenName, setSelectedName] = useState<string | null>(null);
  const [view, setView] = useState<PaneView>({ tab: "chat" });
  const [employees, setEmployees] = useState<EmployeesTab | null>(null);
  const [rolesOpen, setRolesOpen] = useState(false);
  const [skillsOpen, setSkillsOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Default to the first hire; fall back if the chosen agent gets fired.
  const names = snapshot?.agents.map((a) => a.name) ?? [];
  const selectedName = chosenName && names.includes(chosenName) ? chosenName : (names[0] ?? null);
  const selectedId = snapshot?.agents.find((a) => a.name === selectedName)?._id ?? null;
  const selectById = (id: string) => {
    const agent = snapshot?.agents.find((a) => a._id === id);
    if (agent) {
      setSelectedName(agent.name);
      setView({ tab: "chat" });
    }
  };

  return (
    <div className="grid h-dvh grid-cols-[minmax(0,1fr)_minmax(22rem,30rem)]">
      <main className="flex min-h-0 flex-col">
        <div className="relative min-h-0 flex-1">
          <OfficeMenu
            items={[
              { label: "Employees", onSelect: () => setEmployees("profile") },
              { label: "Roles", onSelect: () => setRolesOpen(true) },
              { label: "Skills", onSelect: () => setSkillsOpen(true) },
            ]}
          />
          <OfficeCanvas snapshot={snapshot} selectedId={selectedId} onSelect={selectById} />
        </div>
        <ActivityStrip
          runs={snapshot?.runs ?? []}
          now={now}
          onOpenArtifact={(id) => setView({ tab: "docs", artifactId: id })}
          onSelectAgent={selectById}
        />
      </main>
      {employees && (
        <EmployeesDialog
          roster={snapshot?.agents ?? []}
          jobs={snapshot?.jobs ?? []}
          roles={snapshot?.roles ?? []}
          now={now}
          initialName={selectedName}
          initialTab={employees}
          onClose={() => setEmployees(null)}
          onSelectName={(name) => {
            setSelectedName(name);
            setView({ tab: "chat" });
          }}
          onOpenRoles={() => {
            setEmployees(null);
            setRolesOpen(true);
          }}
          onOpenSkills={() => {
            setEmployees(null);
            setSkillsOpen(true);
          }}
        />
      )}
      {rolesOpen && <RolesDialog onClose={() => setRolesOpen(false)} />}
      {skillsOpen && <SkillsDialog onClose={() => setSkillsOpen(false)} />}
      <div className="min-h-0 border-l border-hairline">
        <ChatPane
          snapshot={snapshot}
          now={now}
          selectedName={selectedName}
          onSelectName={setSelectedName}
          view={view}
          onView={setView}
        />
      </div>
    </div>
  );
}
