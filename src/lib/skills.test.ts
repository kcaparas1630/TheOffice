import { describe, expect, test } from "vitest";
import { applyUses, levelFor, levelLabel, mapSmitherySkill, slugify, usesToNext } from "./skills";

describe("skill levels", () => {
  test("uses earn levels on Kent's ladder: 50, +100, +300, +500", () => {
    expect(levelFor(0)).toBe(1);
    expect(levelFor(49)).toBe(1);
    expect(levelFor(50)).toBe(2);
    expect(levelFor(149)).toBe(2);
    expect(levelFor(150)).toBe(3);
    expect(levelFor(450)).toBe(4);
    expect(levelFor(949)).toBe(4);
    expect(levelFor(950)).toBe(5);
    expect(levelFor(10_000)).toBe(5);
  });

  test("labels and distance to the next level", () => {
    expect(levelLabel(1)).toBe("learning");
    expect(levelLabel(5)).toBe("expert");
    expect(levelLabel(9)).toBe("expert");
    expect(usesToNext(0, 1)).toBe(50);
    expect(usesToNext(120, 2)).toBe(30);
    expect(usesToNext(5, 5)).toBeNull();
  });

  test("counting uses promotes but never demotes a hand-set level", () => {
    expect(applyUses({ uses: 48, level: 1 }, 2)).toEqual({ uses: 50, level: 2, promoted: true });
    expect(applyUses({ uses: 0, level: 4 }, 1)).toEqual({ uses: 1, level: 4, promoted: false });
    expect(applyUses({ uses: 949, level: 3 }, 1)).toEqual({ uses: 950, level: 5, promoted: true });
  });
});

describe("Smithery mapping", () => {
  test("keeps the catalogue fields we use and namespaces the slug", () => {
    const row = mapSmitherySkill({
      namespace: "anthropics",
      slug: "pdf",
      displayName: "PDF",
      description: "  Read, merge and create PDF files. ",
      prompt: "# PDF\nUse pypdf…",
      categories: ["Productivity", "Files"],
      gitUrl: "https://github.com/anthropics/skills/tree/main/skills/pdf",
      verified: true,
      totalActivations: 93,
    });
    expect(row).toMatchObject({
      name: "PDF",
      slug: "anthropics/pdf",
      description: "Read, merge and create PDF files.",
      category: "Productivity",
      source: "smithery",
      namespace: "anthropics",
      verified: true,
      popularity: 93,
    });
    expect(row.prompt).toContain("pypdf");
  });

  test("falls back sensibly when fields are missing", () => {
    const row = mapSmitherySkill({ namespace: "x", slug: "thing" });
    expect(row.name).toBe("thing");
    expect(row.category).toBeNull();
    expect(row.sourceUrl).toBe("https://smithery.ai/skills/x/thing");
    expect(row.popularity).toBe(0);
    expect(row.prompt).toBeNull();
  });

  test("slugify", () => {
    expect(slugify("  Deck Building (PPTX)! ")).toBe("deck-building-pptx");
  });
});
