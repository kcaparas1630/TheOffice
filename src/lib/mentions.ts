// Parses a line of terminal input into a mention, a command, or noise.

export type ParsedInput =
  | { kind: "mention"; agentName: string; message: string }
  | { kind: "command"; command: string; args: string[] }
  | { kind: "empty" }
  | { kind: "unknown"; raw: string };

const MENTION_RE = /^@([A-Za-z][A-Za-z0-9-]*)\s*([\s\S]*)$/;

export function parseInput(line: string): ParsedInput {
  const trimmed = line.trim();
  if (!trimmed) return { kind: "empty" };

  if (trimmed.startsWith("/")) {
    const [command, ...args] = trimmed.slice(1).split(/\s+/);
    return { kind: "command", command: command.toLowerCase(), args };
  }

  const match = trimmed.match(MENTION_RE);
  if (match) {
    const [, agentName, message] = match;
    if (!message.trim()) return { kind: "unknown", raw: trimmed };
    return { kind: "mention", agentName, message: message.trim() };
  }

  return { kind: "unknown", raw: trimmed };
}
