"use client";

// Right pane: roster tabs, the selected agent's thread, and documents.
// Same conversation store as the terminal (`@convex-dev/agent` threads), so
// what you say here shows up in `npm run office` and vice-versa.
import { useEffect, useRef, useState } from "react";
import { useAction, useMutation, usePaginatedQuery } from "convex/react";
import Markdown from "react-markdown";
import { api } from "@/server/convex/_generated/api";
import type { Id } from "@/server/convex/_generated/dataModel";
import { parseInput } from "@/lib/mentions";
import { helpText } from "@/lib/commands";
import { timeAgo } from "@/lib/time";
import type { Snapshot } from "@/components/office/OfficeCanvas";
import { Composer } from "./Composer";
import { ArtifactView, DocsList } from "./Docs";
import { LookPicker } from "./LookPicker";

export type PaneView = { tab: "chat" } | { tab: "docs"; artifactId?: Id<"artifacts"> };

interface Notice {
  id: number;
  agent: string | null; // null = shown in every thread
  text: string;
  tone: "info" | "error";
  at: number;
}

export function ChatPane({
  snapshot,
  now,
  selectedName,
  onSelectName,
  view,
  onView,
}: {
  snapshot: Snapshot | undefined;
  now: number;
  selectedName: string | null;
  onSelectName: (name: string) => void;
  view: PaneView;
  onView: (view: PaneView) => void;
}) {
  const roster = snapshot?.agents ?? [];
  const names = roster.map((a) => a.name);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [pending, setPending] = useState<{ agent: string; text: string } | null>(null);

  const sendMessage = useAction(api.chat.sendMessage);
  const revise = useAction(api.briefs.revise);
  const emailLatest = useAction(api.email.emailLatest);
  const dispatchTask = useMutation(api.delegation.dispatchTask);
  const dispatchJob = useMutation(api.briefs.dispatchJobNow);

  const notice = (text: string, agent: string | null = null, tone: Notice["tone"] = "info") =>
    setNotices((n) => [...n.slice(-49), { id: Date.now() + Math.random(), agent, text, tone, at: Date.now() }]);

  const resolve = (name: string) => names.find((n) => n.toLowerCase() === name.toLowerCase()) ?? null;

  const talk = async (agent: string, text: string) => {
    onSelectName(agent);
    onView({ tab: "chat" });
    setPending({ agent, text });
    try {
      await sendMessage({ agentName: agent, message: text });
    } catch (e) {
      notice(errorText(e), agent, "error");
    } finally {
      setPending(null);
    }
  };

  const runCommand = async (command: string, args: string[]) => {
    const [first, ...rest] = args;
    const target = first ? resolve(first) : null;
    const needsAgent = ["task", "run", "redo", "email"].includes(command);
    if (needsAgent && !target) {
      notice(first ? `Nobody named "${first}" works here.` : `Usage: /${command} Name …`, null, "error");
      return;
    }
    const text = rest.filter((w) => w !== "&").join(" ");
    try {
      switch (command) {
        case "help":
          notice(helpText());
          break;
        case "task": {
          if (!text) return notice("Usage: /task Name what to do", null, "error");
          const r = await dispatchTask({ agentName: target!, task: text });
          notice(`${r.agent} took the task. Watch the office.`, target);
          break;
        }
        case "run": {
          const r = await dispatchJob({ agentName: target!, jobTitle: text || undefined });
          notice(`${r.agent} is running "${r.title}".`, target);
          break;
        }
        case "redo": {
          if (!text) return notice("Usage: /redo Name what was wrong", null, "error");
          notice(`${target} is revising…`, target);
          const r = await revise({ agentName: target!, critique: text });
          notice(`${target} finished "${r.title}" (v${r.version}). See Docs.`, target);
          break;
        }
        case "email": {
          const r = await emailLatest({ agentName: target! });
          notice(JSON.stringify(r), target);
          break;
        }
        default:
          notice(`/${command} lives in the terminal: npm run office`, null, "error");
      }
    } catch (e) {
      notice(errorText(e), target, "error");
    }
  };

  const submit = async (text: string) => {
    const parsed = parseInput(text);
    if (parsed.kind === "empty") return;
    if (parsed.kind === "command") return runCommand(parsed.command, parsed.args);
    if (parsed.kind === "mention") {
      const target = resolve(parsed.agentName);
      if (!target) return notice(`Nobody named "${parsed.agentName}" works here.`, null, "error");
      return talk(target, parsed.message);
    }
    if (!selectedName) return notice("Hire someone first: menu (top-left) → Hire a new employee", null, "error");
    return talk(selectedName, parsed.raw);
  };

  const working = roster.filter((a) => a.status === "working").length;
  const selected = roster.find((a) => a.name === selectedName) ?? null;

  return (
    <aside className="flex h-full min-h-0 flex-col">
      <header className="border-b border-hairline px-4 pt-3 pb-2">
        <div className="flex items-baseline justify-between">
          <h1 className="text-sm font-semibold">The Office</h1>
          <span className="text-xs text-muted font-mono">
            {roster.length} people · {working} working
          </span>
        </div>
        <nav className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm">
          {roster.map((a) => (
            <button
              key={a._id}
              onClick={() => {
                onSelectName(a.name);
                onView({ tab: "chat" });
              }}
              className={`flex items-center gap-1.5 ${
                a.name === selectedName && view.tab === "chat" ? "font-semibold underline underline-offset-4" : "text-muted"
              }`}
              title={a.jobTitle}
            >
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${
                  a.status === "working" ? "bg-working animate-pulse" : "bg-hairline"
                }`}
              />
              {a.name}
            </button>
          ))}
          <button
            onClick={() => onView({ tab: "docs" })}
            className={`ml-auto ${view.tab === "docs" ? "font-semibold underline underline-offset-4" : "text-muted"}`}
          >
            Docs
          </button>
        </nav>
        {selected && view.tab === "chat" && (
          <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-hairline pt-2 text-xs font-mono text-muted">
            <span className="truncate">
              <span className="text-foreground">{selected.name}</span> · {selected.jobTitle}
            </span>
            <LookPicker agentName={selected.name} current={selected.sprite} />
          </div>
        )}
      </header>

      {view.tab === "docs" ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {view.artifactId ? (
            <ArtifactView
              artifactId={view.artifactId}
              onBack={() => onView({ tab: "docs" })}
              onOpen={(id) => onView({ tab: "docs", artifactId: id })}
            />
          ) : (
            <DocsList
              artifacts={snapshot?.artifacts ?? []}
              now={now}
              onOpen={(id) => onView({ tab: "docs", artifactId: id })}
            />
          )}
        </div>
      ) : (
        <Thread
          agent={selectedName}
          now={now}
          notices={notices.filter((n) => n.agent === null || n.agent === selectedName)}
          pending={pending && pending.agent === selectedName ? pending.text : null}
        />
      )}

      <Composer
        roster={names}
        selectedName={selectedName}
        busy={false}
        placeholder={selectedName ? `Message ${selectedName}… (or @Name, / for commands)` : "Hire someone from the menu first"}
        onSubmit={submit}
      />
    </aside>
  );
}

function Thread({
  agent,
  now,
  notices,
  pending,
}: {
  agent: string | null;
  now: number;
  notices: Notice[];
  pending: string | null;
}) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.chat.messages,
    agent ? { agentName: agent } : "skip",
    { initialNumItems: 40 }
  );
  const messages = [...results].sort((a, b) => a.order - b.order || a.stepOrder - b.stepOrder);
  const bottom = useRef<HTMLDivElement>(null);
  const count = messages.length + notices.length + (pending ? 1 : 0);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [count, agent]);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 text-sm">
      {status === "CanLoadMore" && (
        <button onClick={() => loadMore(40)} className="mb-3 text-xs text-muted hover:underline">
          earlier messages
        </button>
      )}
      {!agent ? (
        <p className="text-muted">Nobody to talk to yet.</p>
      ) : messages.length === 0 && status !== "LoadingFirstPage" ? (
        <p className="text-muted">Say hello. {agent} answers from real work state only.</p>
      ) : null}
      <ol className="space-y-3">
        {messages.map((m) => (
          <li key={m._id} className={m.role === "user" ? "text-muted" : ""}>
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted">
              {m.role === "user" ? "you" : agent} · {timeAgo(m.createdAt, now)}
            </div>
            <div className="md mt-0.5">
              {m.text ? <Markdown>{m.text}</Markdown> : <span className="text-muted">…</span>}
            </div>
          </li>
        ))}
        {pending && (
          <>
            <li className="text-muted">
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted">you · sending</div>
              <div className="mt-0.5 whitespace-pre-wrap">{pending}</div>
            </li>
            <li className="text-muted animate-pulse">{agent} is thinking…</li>
          </>
        )}
        {notices.map((n) => (
          <li
            key={n.id}
            className={`whitespace-pre-wrap border-l-2 pl-2 text-xs font-mono ${
              n.tone === "error" ? "border-failed text-failed" : "border-hairline text-muted"
            }`}
          >
            {n.text}
          </li>
        ))}
      </ol>
      <div ref={bottom} />
    </div>
  );
}

function errorText(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  // Convex wraps thrown errors with a stack-y prefix; keep the human part.
  const m = msg.match(/Uncaught Error: (.*?)(\n|$)/);
  return m ? m[1] : msg.split("\n")[0];
}
