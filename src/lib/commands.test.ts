import { describe, expect, test } from "vitest";
import { WEB_COMMANDS, fillCommand, helpText, matchCommands } from "./commands";

describe("command suggestions", () => {
  test("empty input lists every command; a prefix narrows it", () => {
    expect(matchCommands("")).toHaveLength(WEB_COMMANDS.length);
    expect(matchCommands("r").map((c) => c.name)).toEqual(["run", "redo"]);
    expect(matchCommands("RE").map((c) => c.name)).toEqual(["redo"]);
    expect(matchCommands("zzz")).toEqual([]);
  });

  test("filling a command uses the agent you're looking at and leaves room to type", () => {
    const task = WEB_COMMANDS.find((c) => c.name === "task")!;
    const email = WEB_COMMANDS.find((c) => c.name === "email")!;
    const help = WEB_COMMANDS.find((c) => c.name === "help")!;
    expect(fillCommand(task, "Hazel")).toBe("/task Hazel ");
    expect(fillCommand(task, null)).toBe("/task ");
    expect(fillCommand(email, "Hazel")).toBe("/email Hazel");
    expect(fillCommand(help, "Hazel")).toBe("/help");
  });

  test("every command has a runnable example that starts with its own name", () => {
    for (const c of WEB_COMMANDS) {
      expect(c.example.startsWith(`/${c.name}`)).toBe(true);
      expect(helpText()).toContain(c.name === "help" ? "@Name" : c.example);
    }
  });
});
