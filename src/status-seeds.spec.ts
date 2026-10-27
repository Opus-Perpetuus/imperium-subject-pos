import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { STATUS_OPTION_SEEDS } from "./status-seeds";

describe("status seeds", () => {
  test("valores únicos y campo correcto", () => {
    for (const s of STATUS_OPTION_SEEDS) {
      const v = s.options.map((o) => o.value);
      expect(new Set(v).size).toBe(v.length);
      expect(s.options.every((o) => o.field_name === s.status_fields?.[0])).toBe(true);
    }
  });
  test("input-status sin options literales", () => {
    for (const m of ["pos-session", "pos-tickets", "pos-order"]) {
      const src = readFileSync(new URL(`./modules/${m}/${m}.pages.ts`, import.meta.url), "utf8");
      expect(src).toMatch(/component: "input-status", label: "Estado" \}/);
    }
  });
});
