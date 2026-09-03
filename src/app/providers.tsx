"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { useMemo } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  const client = useMemo(() => (url ? new ConvexReactClient(url) : null), [url]);
  if (!client) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8 font-mono text-sm">
        <p>
          <code>NEXT_PUBLIC_CONVEX_URL</code> is not set. Run <code>npx convex dev</code> once to
          create <code>.env.local</code>, then restart <code>npm run dev</code>.
        </p>
      </main>
    );
  }
  return <ConvexProvider client={client}>{children}</ConvexProvider>;
}
