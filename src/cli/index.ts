/* The Office — headless terminal control.
 *
 *   npm run office
 *
 * Talk to an agent:      @Edna how was your day?
 * Hire a new agent:      /hire
 * See who works here:    /roster
 * An agent's work state: /status Edna
 */
import { config as loadEnv } from "dotenv";
import { createInterface, type Interface } from "node:readline/promises";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../server/convex/_generated/api";
import { parseInput } from "./mentions";
import { validateAgentName } from "../lib/agentName";
import { formatWorkState } from "../server/vercel/prompts";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true });

const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;

const HELP = `
${bold("The Office — commands")}
  @<Name> <message>          Talk to an agent (e.g. @Edna what's the status?)
  /hire                      Hire a new agent (interactive)
  /roster                    List everyone in the office
  /status <name>             Show an agent's real work state
  /assign <name>             Give an agent a standing job (interactive)
  /jobs <name>               List an agent's jobs and learned lessons
  /run <name>                Run their job right now (don't wait for the cron)
  /docs <name>               List documents an agent has produced
  /read <name> [title]       Print a document (latest, or newest matching title)
  /redo <name> <critique>    "This sucks, redo it because X" — revise latest doc
  /supervisor <name> <boss>  Make <boss> the supervisor of <name>
  /fire <name>               Remove an agent and their records
  /help                      This help
  /quit                      Leave the office
`;

function client(): ConvexHttpClient {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL ?? process.env.CONVEX_URL;
  if (!url) {
    console.error(
      red("No Convex deployment configured.") +
        "\nRun `npx convex dev` once to create one (it writes NEXT_PUBLIC_CONVEX_URL to .env.local)," +
        "\nand keep it running in another terminal while you use the office."
    );
    process.exit(1);
  }
  return new ConvexHttpClient(url);
}

async function askList(rl: Interface, prompt: string): Promise<string[]> {
  console.log(dim(`${prompt} (one per line, empty line to finish)`));
  const items: string[] = [];
  for (;;) {
    const line = (await rl.question(dim(`  ${items.length + 1}. `))).trim();
    if (!line) break;
    items.push(line);
  }
  return items;
}

async function hireWizard(rl: Interface, convex: ConvexHttpClient) {
  console.log(bold("\nHiring a new agent. This is where you make them yours.\n"));

  let name = "";
  for (;;) {
    name = (await rl.question("Name (their @mention handle): ")).trim();
    const error = validateAgentName(name);
    if (!error) break;
    console.log(yellow(`  ${error}`));
  }

  const jobTitle = (await rl.question("Job title (e.g. CTO): ")).trim();
  console.log(dim("Job description — a real description of the role, not a command."));
  const jobDescription = (await rl.question("Job description: ")).trim();
  const successfulDay = await askList(rl, "A successful day would be:");
  console.log(dim("Personality traits — e.g. jolly, optimistic / strict, pessimistic."));
  const traitsRaw = (await rl.question("Traits (comma-separated): ")).trim();
  const traits = traitsRaw.split(",").map((t) => t.trim()).filter(Boolean);
  const notes = (await rl.question("Anything else about who they are? (optional): ")).trim();

  const roster = await convex.query(api.agents.roster, {});
  let supervisorName: string | undefined;
  if (roster.length > 0) {
    const bosses = roster.map((a) => a.name).join(", ");
    const answer = (
      await rl.question(`Supervisor? (${bosses}, or empty for none): `)
    ).trim();
    if (answer) supervisorName = answer;
  }

  const hired = await convex.mutation(api.agents.hire, {
    name,
    jobTitle,
    jobDescription,
    successfulDay,
    traits,
    notes,
    supervisorName,
  });
  console.log(
    `\n${cyan(hired.name)} joined the office as ${bold(jobTitle)}.` +
      ` Say hi: ${bold(`@${hired.name} welcome aboard`)}\n`
  );
}

async function showRoster(convex: ConvexHttpClient) {
  const roster = await convex.query(api.agents.roster, {});
  if (roster.length === 0) {
    console.log(dim("The office is empty. Use /hire to bring someone in."));
    return;
  }
  for (const agent of roster) {
    const traits = agent.traits.length ? ` — ${agent.traits.join(", ")}` : "";
    const boss = agent.supervisorName ? ` (reports to ${agent.supervisorName})` : "";
    console.log(`  ${cyan("@" + agent.name)}  ${agent.jobTitle}${boss} [${agent.status}]${dim(traits)}`);
  }
}

async function showStatus(convex: ConvexHttpClient, name: string) {
  const agent = await convex.query(api.agents.getByName, { name });
  if (!agent) {
    console.log(yellow(`Nobody named "${name}" works here.`));
    return;
  }
  const state = await convex.query(api.work.statusForAgent, { agentId: agent._id });
  if (!state) return;
  console.log(`\n${cyan("@" + agent.name)} — ${agent.jobTitle}`);
  console.log(dim(formatWorkState(state).split("\n").slice(1).join("\n")) + "\n");
}

async function assignWizard(rl: Interface, convex: ConvexHttpClient, agentName: string) {
  console.log(bold(`\nAssigning a standing job to ${agentName}.\n`));
  const title = (await rl.question("Job title (e.g. Daily Tech Brief): ")).trim();
  console.log(dim("The spec is what 'good' means — it drives both generation and critiques."));
  const spec = (await rl.question("Spec: ")).trim();
  const schedule = (await rl.question("Schedule (cron, empty = daily 14:00 UTC): ")).trim();
  const result = await convex.mutation(api.jobs.assign, {
    agentName,
    title,
    spec,
    schedule: schedule || undefined,
  });
  console.log(
    `\n${cyan(result.agent)} now owns ${bold(result.title)}.` +
      ` Trigger it any time with ${bold(`/run ${result.agent}`)} — the cron runs daily at 14:00 UTC.\n`
  );
}

async function showJobs(convex: ConvexHttpClient, name: string) {
  const jobs = await convex.query(api.jobs.listForAgent, { agentName: name });
  if (jobs === null) {
    console.log(yellow(`Nobody named "${name}" works here.`));
    return;
  }
  if (jobs.length === 0) {
    console.log(dim(`${name} has no standing jobs. Use /assign ${name}.`));
    return;
  }
  for (const job of jobs) {
    console.log(`  ${bold(job.title)} (${job.active ? "active" : "paused"}, cron ${job.schedule})`);
    console.log(dim(`    spec: ${job.spec}`));
    for (const lesson of job.lessons) console.log(dim(`    lesson: ${lesson}`));
  }
}

async function runJob(convex: ConvexHttpClient, name: string) {
  process.stdout.write(dim(`${name} is working...`));
  try {
    const result = await convex.action(api.pipeline.runJobNow, { agentName: name });
    process.stdout.write("\r\x1b[K");
    console.log(
      `${cyan(name)} finished ${bold(result.title)} — ${result.items} item(s)` +
        `${result.slowDay ? dim(" (slow day)") : ""}. Read it: ${bold(`/read ${name}`)}\n`
    );
  } catch (error) {
    process.stdout.write("\r\x1b[K");
    console.log(red(error instanceof Error ? error.message : String(error)) + "\n");
  }
}

async function showDocs(convex: ConvexHttpClient, name: string) {
  const docs = await convex.query(api.work.docsForAgent, { agentName: name });
  if (docs === null) {
    console.log(yellow(`Nobody named "${name}" works here.`));
    return;
  }
  if (docs.length === 0) {
    console.log(dim(`${name} hasn't produced any documents yet.`));
    return;
  }
  for (const doc of docs) {
    const when = new Date(doc.createdAt).toISOString().slice(0, 16).replace("T", " ");
    console.log(`  ${bold(doc.title)} ${dim(`(${doc.kind} v${doc.version}, ${when} UTC, ${doc.sourceCount} sources)`)}`);
  }
}

async function readDoc(convex: ConvexHttpClient, name: string, titleFragment?: string) {
  const result = await convex.query(api.work.readDoc, { agentName: name, titleFragment });
  if (result === null) {
    console.log(yellow(`Nobody named "${name}" works here.`));
    return;
  }
  if (!result.doc) {
    console.log(dim(`${result.agentName} has no matching documents.`));
    return;
  }
  console.log(`\n${"─".repeat(60)}\n${result.doc.contentMd}\n${"─".repeat(60)}\n`);
}

async function redo(convex: ConvexHttpClient, name: string, critique: string) {
  process.stdout.write(dim(`${name} is revising...`));
  try {
    const result = await convex.action(api.pipeline.revise, { agentName: name, critique });
    process.stdout.write("\r\x1b[K");
    console.log(
      `${cyan(name)} produced ${bold(result.title)} (version ${result.version}).` +
        ` Read it: ${bold(`/read ${name}`)}\n`
    );
  } catch (error) {
    process.stdout.write("\r\x1b[K");
    console.log(red(error instanceof Error ? error.message : String(error)) + "\n");
  }
}

async function talkTo(convex: ConvexHttpClient, agentName: string, message: string) {
  process.stdout.write(dim(`${agentName} is thinking...`));
  try {
    const { reply, agentName: name } = await convex.action(api.chat.sendMessage, {
      agentName,
      message,
    });
    process.stdout.write("\r\x1b[K");
    console.log(`${cyan(name)}: ${reply}\n`);
  } catch (error) {
    process.stdout.write("\r\x1b[K");
    console.log(red(error instanceof Error ? error.message : String(error)) + "\n");
  }
}

async function main() {
  const convex = client();
  console.log(bold("\n🏢 The Office (headless)"));
  console.log(dim("Type /help for commands. Talk to agents with @Name <message>.\n"));

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  rl.on("close", () => {
    console.log(dim("\nLights off. See you tomorrow."));
    process.exit(0);
  });

  for (;;) {
    const line = await rl.question(bold("you> "));
    const parsed = parseInput(line);
    try {
      switch (parsed.kind) {
        case "empty":
          break;
        case "mention":
          await talkTo(convex, parsed.agentName, parsed.message);
          break;
        case "command":
          switch (parsed.command) {
            case "help":
              console.log(HELP);
              break;
            case "hire":
              await hireWizard(rl, convex);
              break;
            case "roster":
              await showRoster(convex);
              break;
            case "status":
              if (!parsed.args[0]) console.log(yellow("Usage: /status <name>"));
              else await showStatus(convex, parsed.args[0]);
              break;
            case "assign":
              if (!parsed.args[0]) console.log(yellow("Usage: /assign <name>"));
              else await assignWizard(rl, convex, parsed.args[0]);
              break;
            case "jobs":
              if (!parsed.args[0]) console.log(yellow("Usage: /jobs <name>"));
              else await showJobs(convex, parsed.args[0]);
              break;
            case "run":
              if (!parsed.args[0]) console.log(yellow("Usage: /run <name>"));
              else await runJob(convex, parsed.args[0]);
              break;
            case "docs":
              if (!parsed.args[0]) console.log(yellow("Usage: /docs <name>"));
              else await showDocs(convex, parsed.args[0]);
              break;
            case "read":
              if (!parsed.args[0]) console.log(yellow("Usage: /read <name> [title fragment]"));
              else await readDoc(convex, parsed.args[0], parsed.args.slice(1).join(" ") || undefined);
              break;
            case "redo":
              if (parsed.args.length < 2) {
                console.log(yellow('Usage: /redo <name> <critique> — e.g. /redo Edna "too long, cut the fluff"'));
              } else {
                await redo(convex, parsed.args[0], parsed.args.slice(1).join(" "));
              }
              break;
            case "supervisor":
              if (parsed.args.length < 2) {
                console.log(yellow("Usage: /supervisor <agent> <boss>"));
              } else {
                const result = await convex.mutation(api.agents.assignSupervisor, {
                  agentName: parsed.args[0],
                  supervisorName: parsed.args[1],
                });
                console.log(`${cyan(result.supervisor)} now supervises ${cyan(result.agent)}.`);
              }
              break;
            case "fire": {
              if (!parsed.args[0]) {
                console.log(yellow("Usage: /fire <name>"));
                break;
              }
              const sure = (
                await rl.question(`Really fire ${parsed.args[0]} and delete their records? (y/N) `)
              ).trim();
              if (sure.toLowerCase() === "y") {
                const result = await convex.mutation(api.agents.fire, { name: parsed.args[0] });
                console.log(dim(`${result.fired} has left the building.`));
              }
              break;
            }
            case "quit":
            case "exit":
              rl.close();
              return;
            default:
              console.log(yellow(`Unknown command /${parsed.command}. Try /help.`));
          }
          break;
        case "unknown":
          console.log(
            yellow("Talk to an agent with @Name <message>, or use /help for commands.")
          );
          break;
      }
    } catch (error) {
      console.log(red(error instanceof Error ? error.message : String(error)));
    }
  }
}

main();
