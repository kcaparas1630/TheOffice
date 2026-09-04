"use client";

// Right pane: one chat for the whole office. Every agent's thread is merged
// into a single stream (`chat.timeline`); each person has a colour and a
// bold name so you can tell who's talking. Plain messages go to the person
// in the composer's "to" chip (or whoever you clicked in the office); `@Name …`
// addresses anyone. Same threads as the terminal underneath.
import { useEffect, useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import Markdown from "react-markdown";
import { api } from "@/server/convex/_generated/api";
import type { Id } from "@/server/convex/_generated/dataModel";
import { parseInput } from "@/lib/mentions";
import { helpText } from "@/lib/commands";
import { agentColor, tint } from "@/lib/office/colors";
import { timeAgo } from "@/lib/time";
import type { Snapshot } from "@/components/office/OfficeCanvas";
import { Composer } from "./Composer";
import { ArtifactView, DocsList } from "./Docs";

export type PaneView = { tab: "chat" } | { tab: "docs"; artifactId?: Id<"artifacts"> };

interface Notice {
  id: number;
  agent: string | null; // who it's about, if anyone
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
  const colorOf = (name: string) => agentColor(Math.max(0, names.indexOf(name)));
  const [notices, setNotices] = useState<Notice[]>([]);
  const [pending, setPending] = useState<{ agent: string; text: string } | null>(null);

  const sendMessage = useAction(api.chat.sendMessage);
  const revise = useAction(api.briefs.revise);
  const emailLatest = useAction(api.email.emailLatest);
  const dispatchTask = useMutation(api.delegation.dispatchTask);
  const dispatchJob = useMutation(api.briefs.dispatchJobNow);
  const giveTurn = useMutation(api.heartbeat.giveTurn);

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
    const needsAgent = ["task", "run", "redo", "email", "turn"].includes(command);
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
        case "turn": {
          const r = await giveTurn({ agentName: target! });
          notice(`${r.agent} is taking a turn: reading their scorecard and inbox, then choosing what to do.`, target);
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
    if (!selectedName) return notice("Hire someone first: menu (top-left) → Employees", null, "error");
    return talk(selectedName, parsed.raw);
  };

  const working = roster.filter((a) => a.status === "working").length;

  return (
    <aside className="flex h-full min-h-0 flex-col">
      <header className="border-b border-hairline px-4 pt-3 pb-2">
        <div className="flex items-baseline justify-between">
          <h1 className="text-sm font-semibold">The Office</h1>
          <nav className="flex items-baseline gap-3 text-xs font-mono">
            <span className="text-muted">
              {roster.length} people · {working} working
            </span>
            <button
              onClick={() => onView({ tab: "chat" })}
              className={view.tab === "chat" ? "font-semibold underline underline-offset-4" : "text-muted hover:text-foreground"}
            >
              Chat
            </button>
            <button
              onClick={() => onView({ tab: "docs" })}
              className={view.tab === "docs" ? "font-semibold underline underline-offset-4" : "text-muted hover:text-foreground"}
            >
              Docs
            </button>
          </nav>
        </div>
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
        <Stream now={now} colorOf={colorOf} notices={notices} pending={pending} empty={roster.length === 0} />
      )}

      <Composer
        roster={names}
        selectedName={selectedName}
        onSelectName={onSelectName}
        busy={false}
        placeholder={selectedName ? `Message ${selectedName}… (@Name for someone else, / for commands)` : "Hire someone from the menu first"}
        onSubmit={submit}
      />
    </aside>
  );
}

type Item =
  | { kind: "message"; id: string; agent: string; role: string; text: string; at: number; pending?: boolean; toName?: string | null }
  | { kind: "notice"; id: string; agent: string | null; text: string; tone: Notice["tone"]; at: number };

function Stream({
  now,
  colorOf,
  notices,
  pending,
  empty,
}: {
  now: number;
  colorOf: (name: string) => string;
  notices: Notice[];
  pending: { agent: string; text: string } | null;
  empty: boolean;
}) {
  const messages = useQuery(api.chat.timeline);
  const bottom = useRef<HTMLDivElement>(null);

  const items: Item[] = [
    ...(messages ?? []).map<Item>((m) => ({
      kind: "message",
      id: m._id,
      agent: m.agentName,
      role: m.role,
      text: m.text,
      at: m.createdAt,
      toName: m.toName,
    })),
    ...notices.map<Item>((n) => ({ kind: "notice", id: String(n.id), agent: n.agent, text: n.text, tone: n.tone, at: n.at })),
  ].sort((a, b) => a.at - b.at);
  // The draft shows as "sending" only until the thread has stored it; the
  // reply takes longer, so the pending state outlives the message itself.
  const stored =
    pending &&
    (messages ?? []).some(
      (m) => m.role === "user" && m.agentName === pending.agent && m.text.trim() === pending.text.trim()
    );
  if (pending && !stored) {
    items.push({ kind: "message", id: "pending", agent: pending.agent, role: "user", text: pending.text, at: now, pending: true });
  }

  const count = items.length;
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [count]);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 text-sm">
      {empty ? (
        <p className="text-muted">Nobody to talk to yet.</p>
      ) : messages && items.length === 0 ? (
        <p className="text-muted">Say hello. Everyone answers from real work state only.</p>
      ) : null}
      <ol className="space-y-3">
        {items.map((item) => {
          if (item.kind === "notice") {
            return (
              <li
                key={item.id}
                className={`whitespace-pre-wrap border-l-2 pl-2 text-xs font-mono ${
                  item.tone === "error" ? "border-failed text-failed" : "border-hairline text-muted"
                }`}
              >
                {item.agent && <span className="font-semibold">{item.agent} · </span>}
                {item.text}
              </li>
            );
          }
          const color = colorOf(item.agent);
          if (item.role === "user") {
            return (
              <li key={item.id} className="flex justify-end">
                <div className={`max-w-[85%] border border-hairline bg-hairline/30 px-3 py-2 ${item.pending ? "opacity-60" : ""}`}>
                  <div className="text-[11px] font-mono text-muted">
                    <span className="font-semibold text-foreground">you</span> → <span style={{ color }}>{item.agent}</span>
                    {" · "}
                    {item.pending ? "sending" : timeAgo(item.at, now)}
                  </div>
                  <div className="mt-0.5 whitespace-pre-wrap">{item.text}</div>
                </div>
              </li>
            );
          }
          return (
            <li key={item.id} className="flex justify-start">
              <div
                className="max-w-[85%] border-l-[3px] px-3 py-2"
                style={{ borderColor: color, background: tint(color, 0.09) }}
              >
                <div className="text-[11px] font-mono text-muted">
                  <span className="text-[13px] font-bold tracking-wide" style={{ color }}>
                    {item.agent}
                  </span>
                  {item.toName && (
                    <>
                      {" → "}
                      <span
                        className={item.toName === "you" ? "font-semibold text-foreground" : "font-semibold"}
                        style={item.toName === "you" ? undefined : { color: colorOf(item.toName) }}
                      >
                        {item.toName}
                      </span>
                    </>
                  )}
                  {" · "}
                  {timeAgo(item.at, now)}
                </div>
                <div className="md mt-0.5">
                  {item.text ? <Markdown>{item.text}</Markdown> : <span className="text-muted">…</span>}
                </div>
              </div>
            </li>
          );
        })}
        {pending && (
          <li className="text-xs text-muted animate-pulse" style={{ color: colorOf(pending.agent) }}>
            {pending.agent} is thinking…
          </li>
        )}
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
