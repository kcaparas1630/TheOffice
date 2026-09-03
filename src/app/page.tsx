"use client";

// Two panes, per the spec: [Office] | [Chat]. Everything on screen is a
// reactive view of the same Convex records the terminal uses.
import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/server/convex/_generated/api";
import { OfficeCanvas } from "@/components/office/OfficeCanvas";
import { ActivityStrip } from "@/components/office/ActivityStrip";
import { OfficeMenu } from "@/components/office/OfficeMenu";
import { HireDialog } from "@/components/office/HireDialog";
import { ChatPane, type PaneView } from "@/components/chat/ChatPane";

export default function Home() {
  const snapshot = useQuery(api.office.snapshot);
  const [chosenName, setSelectedName] = useState<string | null>(null);
  const [view, setView] = useState<PaneView>({ tab: "chat" });
  const [hiring, setHiring] = useState(false);
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
          <OfficeMenu items={[{ label: "Hire a new employee", onSelect: () => setHiring(true) }]} />
          <OfficeCanvas snapshot={snapshot} selectedId={selectedId} onSelect={selectById} />
        </div>
        <ActivityStrip
          runs={snapshot?.runs ?? []}
          now={now}
          onOpenArtifact={(id) => setView({ tab: "docs", artifactId: id })}
          onSelectAgent={selectById}
        />
      </main>
      {hiring && (
        <HireDialog
          roster={snapshot?.agents ?? []}
          onClose={() => setHiring(false)}
          onHired={(name) => {
            setHiring(false);
            setSelectedName(name);
            setView({ tab: "chat" });
          }}
        />
      )}
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
