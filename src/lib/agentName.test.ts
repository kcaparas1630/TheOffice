import { describe, expect, test } from "vitest";
import { validateAgentName, normalizeAgentName } from "./agentName";

describe("validateAgentName", () => {
  test("accepts simple names", () => {
    expect(validateAgentName("Edna")).toBeNull();
    expect(validateAgentName("Agent1")).toBeNull();
    expect(validateAgentName("mary-jane")).toBeNull();
  });

  test("rejects empty and whitespace-only names", () => {
    expect(validateAgentName("")).toMatch(/required/);
    expect(validateAgentName("   ")).toMatch(/required/);
  });

  test("rejects multi-word names (must be a mention handle)", () => {
    expect(validateAgentName("Edna Krabappel")).toMatch(/single word/);
  });

  test("rejects names that break the mention syntax", () => {
    expect(validateAgentName("@Edna")).not.toBeNull();
    expect(validateAgentName("1edna")).not.toBeNull();
    expect(validateAgentName("e")).not.toBeNull();
    expect(validateAgentName("a".repeat(25))).not.toBeNull();
  });
});

describe("normalizeAgentName", () => {
  test("lowercases and trims for case-insensitive matching", () => {
    expect(normalizeAgentName("  Edna ")).toBe("edna");
    expect(normalizeAgentName("EDNA")).toBe(normalizeAgentName("edna"));
  });
});
