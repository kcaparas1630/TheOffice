import { describe, expect, test } from "vitest";
import { parseInput } from "./mentions";

describe("parseInput", () => {
  test("parses @mentions with a message", () => {
    expect(parseInput("@Edna how was your day?")).toEqual({
      kind: "mention",
      agentName: "Edna",
      message: "how was your day?",
    });
  });

  test("parses @Agent1 style handles", () => {
    expect(parseInput("@Agent1 status please")).toEqual({
      kind: "mention",
      agentName: "Agent1",
      message: "status please",
    });
  });

  test("keeps multi-line messages intact", () => {
    const parsed = parseInput("@Edna redo the brief.\nIt was too long.");
    expect(parsed.kind).toBe("mention");
    if (parsed.kind === "mention") {
      expect(parsed.message).toContain("It was too long.");
    }
  });

  test("a bare @mention with no message is not a mention", () => {
    expect(parseInput("@Edna").kind).toBe("unknown");
    expect(parseInput("@Edna   ").kind).toBe("unknown");
  });

  test("parses slash commands with args", () => {
    expect(parseInput("/status Edna")).toEqual({
      kind: "command",
      command: "status",
      args: ["Edna"],
    });
    expect(parseInput("/HIRE")).toEqual({ kind: "command", command: "hire", args: [] });
  });

  test("empty input", () => {
    expect(parseInput("")).toEqual({ kind: "empty" });
    expect(parseInput("   ")).toEqual({ kind: "empty" });
  });

  test("plain text is unknown (must address an agent)", () => {
    expect(parseInput("hello office").kind).toBe("unknown");
  });
});
