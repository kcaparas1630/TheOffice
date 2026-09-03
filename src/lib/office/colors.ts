// One colour per employee, by hire order, so the same person is always the
// same colour in the chat stream. Muted enough to sit on the warm background.
export const AGENT_COLORS = [
  "#7b2d4a", // burgundy
  "#2f6f8f", // steel blue
  "#2f7a3e", // green
  "#a3611a", // amber
  "#5b4a9e", // violet
  "#b3562a", // rust
  "#1f7a72", // teal
  "#8a5a2b", // brown
];

export function agentColor(index: number): string {
  const n = AGENT_COLORS.length;
  return AGENT_COLORS[((index % n) + n) % n];
}

// "#rrggbb" -> "rgba(r,g,b,alpha)" for bubble backgrounds.
export function tint(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
