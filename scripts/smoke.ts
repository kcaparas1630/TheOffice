/* One-shot smoke test against the running local Convex deployment.
 * Usage: npx tsx scripts/smoke.ts
 */
import { config as loadEnv } from "dotenv";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../src/server/convex/_generated/api";

loadEnv({ path: ".env.local", quiet: true });

async function main() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) throw new Error("NEXT_PUBLIC_CONVEX_URL missing — run `npx convex dev` first.");
  const convex = new ConvexHttpClient(url);

  const before = await convex.query(api.agents.roster, {});
  console.log("roster before:", before.map((a) => a.name));

  if (!before.some((a) => a.name === "Edna")) {
    const hired = await convex.mutation(api.agents.hire, {
      name: "Edna",
      jobTitle: "CTO",
      jobDescription:
        "The job of CTO is to regulate and facilitate growth in the tech space of this company: track the agentic AI ecosystem, spot where the company should invest, and keep the CEO informed without noise.",
      successfulDay: [
        "Reporting to the CEO with brief news",
        "Research on where growth should be for the CEO",
        "Filter out relevant tech news",
      ],
      traits: ["strict", "dry", "direct"],
      notes: "No filler. When criticized, extracts the standard and improves.",
    });
    console.log("hired:", hired);
  }

  const roster = await convex.query(api.agents.roster, {});
  console.log("roster after:", roster);

  const edna = await convex.query(api.agents.getByName, { name: "edna" });
  if (!edna) throw new Error("case-insensitive lookup failed");
  const state = await convex.query(api.work.statusForAgent, { agentId: edna._id });
  console.log("work state:", JSON.stringify(state, null, 2));

  try {
    const chat = await convex.action(api.chat.sendMessage, {
      agentName: "Edna",
      message: "Introduce yourself in one sentence.",
    });
    console.log(`chat reply from ${chat.agentName}:`, chat.reply);
  } catch (error) {
    console.log(
      "chat failed (expected without OPENROUTER_API_KEY):",
      error instanceof Error ? error.message.slice(0, 300) : error
    );
  }
}

main().then(() => process.exit(0));
