import { describe, expect, test } from "vitest";
import { duration, timeAgo } from "./time";

const S = 1000;
const M = 60 * S;
const H = 60 * M;
const D = 24 * H;

describe("timeAgo", () => {
  test("seconds, minutes and hours under a day", () => {
    const now = 10 * D;
    expect(timeAgo(now - 2 * S, now)).toBe("just now");
    expect(timeAgo(now - 30 * S, now)).toBe("30s ago");
    expect(timeAgo(now - 6 * M, now)).toBe("6m ago");
    expect(timeAgo(now - 23 * H, now)).toBe("23h ago");
  });

  test("switches to days after 24 hours, then weeks and months", () => {
    const now = 400 * D;
    expect(timeAgo(now - 24 * H, now)).toBe("1d ago");
    expect(timeAgo(now - 47 * H, now)).toBe("1d ago");
    expect(timeAgo(now - 3 * D, now)).toBe("3d ago");
    expect(timeAgo(now - 8 * D, now)).toBe("1w ago");
    expect(timeAgo(now - 45 * D, now)).toBe("1mo ago");
  });

  test("never goes negative for clock skew", () => {
    expect(timeAgo(5 * S, 0)).toBe("just now");
  });
});

describe("duration", () => {
  test("scales from seconds up to days", () => {
    expect(duration(0, 45 * S)).toBe("45s");
    expect(duration(0, 5 * M + 3 * S)).toBe("5m 3s");
    expect(duration(0, 11 * H + 35 * S)).toBe("11h 0m");
    expect(duration(0, 2 * D + 5 * H)).toBe("2d 5h");
  });
});
