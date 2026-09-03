"use client";

// Documents: the office's artifacts, and a reader with the version chain.
import { useQuery } from "convex/react";
import Markdown from "react-markdown";
import { api } from "@/server/convex/_generated/api";
import type { Id } from "@/server/convex/_generated/dataModel";
import type { Snapshot } from "@/components/office/OfficeCanvas";
import { timeAgo } from "@/lib/time";

export function DocsList({
  artifacts,
  now,
  onOpen,
}: {
  artifacts: Snapshot["artifacts"];
  now: number;
  onOpen: (id: Id<"artifacts">) => void;
}) {
  if (artifacts.length === 0) {
    return <p className="px-4 py-6 text-sm text-muted">No documents yet. Try `/run Name`.</p>;
  }
  return (
    <ul className="divide-y divide-hairline">
      {artifacts.map((a) => (
        <li key={a._id}>
          <button
            onClick={() => onOpen(a._id)}
            className="block w-full px-4 py-2.5 text-left hover:bg-hairline/40"
          >
            <div className="text-sm">{a.title}</div>
            <div className="mt-0.5 text-xs text-muted font-mono">
              {a.agentName} · {a.kind} · v{a.version} · {timeAgo(a.createdAt, now)}
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function ArtifactView({
  artifactId,
  onBack,
  onOpen,
}: {
  artifactId: Id<"artifacts">;
  onBack: () => void;
  onOpen: (id: Id<"artifacts">) => void;
}) {
  const doc = useQuery(api.artifacts.byId, { artifactId });
  return (
    <article className="px-4 py-3">
      <button onClick={onBack} className="text-xs font-mono text-muted hover:underline">
        ← all documents
      </button>
      {doc === undefined ? (
        <p className="mt-4 text-sm text-muted">Loading…</p>
      ) : doc === null ? (
        <p className="mt-4 text-sm text-muted">That document no longer exists.</p>
      ) : (
        <>
          <header className="mt-3 border-b border-hairline pb-3">
            <h2 className="text-base font-semibold leading-snug">{doc.title}</h2>
            <p className="mt-1 text-xs text-muted font-mono">
              {doc.agentName} · {doc.kind} · {new Date(doc.createdAt).toLocaleString()}
            </p>
            {doc.chain.length > 1 && (
              <p className="mt-1 text-xs font-mono">
                <span className="text-muted">versions: </span>
                {doc.chain.map((c, i) => (
                  <span key={c._id}>
                    {i > 0 && <span className="text-muted"> → </span>}
                    {c._id === doc._id ? (
                      <span className="font-semibold">v{c.version}</span>
                    ) : (
                      <button onClick={() => onOpen(c._id)} className="text-accent hover:underline">
                        v{c.version}
                      </button>
                    )}
                  </span>
                ))}
              </p>
            )}
          </header>
          <div className="md mt-3">
            <Markdown>{doc.contentMd}</Markdown>
          </div>
          {doc.sources.length > 0 && (
            <footer className="mt-4 border-t border-hairline pt-3 text-xs">
              <h3 className="text-muted uppercase tracking-wider text-[10px]">Sources</h3>
              <ol className="mt-1 list-decimal space-y-0.5 pl-4">
                {doc.sources.map((s) => (
                  <li key={s.url}>
                    <a href={s.url} target="_blank" rel="noreferrer" className="hover:underline">
                      {s.title}
                    </a>
                  </li>
                ))}
              </ol>
            </footer>
          )}
        </>
      )}
    </article>
  );
}
