import { describe, expect, test } from "vitest";
import { describePhase, localTime, phaseAt, phaseFor } from "./clock";

describe("phaseFor", () => {
  const at = (hour: number, minute: number, weekday = 3) => phaseFor({ hour, minute, weekday });

  test("the working day has an open, lunch, two breaks and a close", () => {
    expect(at(8, 59)).toBe("closed");
    expect(at(9, 0)).toBe("work");
    expect(at(10, 30)).toBe("break");
    expect(at(10, 45)).toBe("work");
    expect(at(12, 0)).toBe("lunch");
    expect(at(12, 59)).toBe("lunch");
    expect(at(13, 0)).toBe("work");
    expect(at(15, 5)).toBe("break");
    expect(at(16, 59)).toBe("work");
    expect(at(17, 0)).toBe("closed");
  });

  test("weekends are closed", () => {
    expect(at(11, 0, 0)).toBe("closed");
    expect(at(11, 0, 6)).toBe("closed");
  });
});

describe("localTime / phaseAt", () => {
  test("converts to the office zone", () => {
    // 2026-09-03T18:30Z is 11:30 in Los Angeles (PDT), a Thursday.
    const now = Date.UTC(2026, 8, 3, 18, 30);
    expect(localTime(now, "America/Los_Angeles")).toEqual({ hour: 11, minute: 30, weekday: 4 });
    expect(phaseAt(now, "America/Los_Angeles")).toBe("work");
    expect(phaseAt(now, "Asia/Tokyo")).toBe("closed"); // 03:30 next day
  });

  test("an unknown zone falls back to UTC instead of throwing", () => {
    const now = Date.UTC(2026, 8, 3, 10, 0);
    expect(localTime(now, "Nowhere/Nope")).toEqual({ hour: 10, minute: 0, weekday: 4 });
  });

  test("phases have plain descriptions", () => {
    expect(describePhase("lunch")).toBe("lunch");
    expect(describePhase("closed")).toMatch(/outside/);
  });
});
