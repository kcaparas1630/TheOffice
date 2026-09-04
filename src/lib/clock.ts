// The office clock: what part of the working day it is, in the office's
// time zone. The heartbeat only gives turns during work phases; the pixel
// office sends people to the lounge and kitchen at lunch and on breaks.
// Pure: no I/O, runs in the browser and in Convex alike.

export type Phase = "closed" | "work" | "break" | "lunch";

export const DEFAULT_TIME_ZONE = "America/Los_Angeles";

export interface LocalTime {
  hour: number; // 0–23
  minute: number;
  weekday: number; // 0 = Sunday
}

// Minutes from midnight. Static for now; a settings screen can own these later.
export const OFFICE_DAY = {
  open: 9 * 60,
  close: 17 * 60,
  lunch: [12 * 60, 13 * 60] as const,
  breaks: [
    [10 * 60 + 30, 10 * 60 + 45],
    [15 * 60, 15 * 60 + 15],
  ] as const,
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function localTime(now: number, timeZone: string): LocalTime {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
      hourCycle: "h23",
    }).formatToParts(new Date(now));
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    return {
      hour: Number(get("hour")) % 24,
      minute: Number(get("minute")),
      weekday: Math.max(0, WEEKDAYS.indexOf(get("weekday"))),
    };
  } catch {
    // Unknown zone or no Intl data: fall back to UTC rather than stall the office.
    const d = new Date(now);
    return { hour: d.getUTCHours(), minute: d.getUTCMinutes(), weekday: d.getUTCDay() };
  }
}

export function phaseFor(t: LocalTime): Phase {
  if (t.weekday === 0 || t.weekday === 6) return "closed";
  const m = t.hour * 60 + t.minute;
  if (m < OFFICE_DAY.open || m >= OFFICE_DAY.close) return "closed";
  if (m >= OFFICE_DAY.lunch[0] && m < OFFICE_DAY.lunch[1]) return "lunch";
  for (const [from, to] of OFFICE_DAY.breaks) if (m >= from && m < to) return "break";
  return "work";
}

export function phaseAt(now: number, timeZone: string): Phase {
  return phaseFor(localTime(now, timeZone));
}

export function describePhase(phase: Phase): string {
  switch (phase) {
    case "work":
      return "working hours";
    case "lunch":
      return "lunch";
    case "break":
      return "a short break";
    case "closed":
      return "outside office hours";
  }
}
