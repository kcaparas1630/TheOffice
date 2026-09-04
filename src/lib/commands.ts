// The web chat's command catalogue: what each slash command does and a
// concrete example, so the composer can suggest them. Pure data + matching;
// the CLI has its own (larger) set in src/cli/index.ts.

export interface CommandSpec {
  name: string; // without the slash
  usage: string; // "/task Name what to do"
  description: string;
  example: string; // a complete, runnable example
  needsAgent: boolean; // first argument is an agent name
  hasText: boolean; // takes free text after the name
}

export const WEB_COMMANDS: CommandSpec[] = [
  {
    name: "task",
    usage: "/task Name what to do",
    description: "Assign work. Team leads decide whether to delegate.",
    example: "/task Hazel summarize this week's AI news for the CEO",
    needsAgent: true,
    hasText: true,
  },
  {
    name: "run",
    usage: "/run Name [job title]",
    description: "Run a standing job now instead of waiting for the cron.",
    example: "/run Hazel",
    needsAgent: true,
    hasText: true,
  },
  {
    name: "redo",
    usage: "/redo Name critique",
    description: "Revise their latest document. The critique becomes a lesson.",
    example: "/redo Hazel too long, cut the fluff and lead with the decision",
    needsAgent: true,
    hasText: true,
  },
  {
    name: "email",
    usage: "/email Name",
    description: "Email their latest document to the CEO.",
    example: "/email Hazel",
    needsAgent: true,
    hasText: false,
  },
  {
    name: "turn",
    usage: "/turn Name",
    description: "Give them a turn now: they read their scorecard and inbox and pick a duty, or rest.",
    example: "/turn Hazel",
    needsAgent: true,
    hasText: false,
  },
  {
    name: "help",
    usage: "/help",
    description: "List these commands in the thread.",
    example: "/help",
    needsAgent: false,
    hasText: false,
  },
];

// Commands whose name starts with what was typed after the slash.
export function matchCommands(partial: string, commands: CommandSpec[] = WEB_COMMANDS): CommandSpec[] {
  const p = partial.trim().toLowerCase();
  return commands.filter((c) => c.name.startsWith(p));
}

// What to put in the box when a suggestion is picked: the command, the
// agent you're looking at (if it takes one), and a trailing space when more
// text is expected so you can keep typing.
export function fillCommand(spec: CommandSpec, agentName: string | null): string {
  let text = `/${spec.name}`;
  if (spec.needsAgent && agentName) text += ` ${agentName}`;
  if (spec.hasText || (spec.needsAgent && !agentName)) text += " ";
  return text;
}

// The `/help` listing, one line per command.
export function helpText(commands: CommandSpec[] = WEB_COMMANDS): string {
  return [
    "@Name message — talk to someone (their real work state is in the answer)",
    ...commands.filter((c) => c.name !== "help").map((c) => `${c.usage} — ${c.description} e.g. ${c.example}`),
    "Hiring, editing and firing live in the menu (top-left of the office); /assign, /feeds, /supervisor in the terminal: npm run office",
  ].join("\n");
}
