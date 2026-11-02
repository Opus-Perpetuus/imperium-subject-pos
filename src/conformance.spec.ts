import { describe, expect, test } from "bun:test";
import {
  assert_kirlet_conformance,
  create_kirlet_test_context,
} from "@opus-perpetuus/imperium-core-kit";
import { join } from "node:path";
import { SUBJECT } from "./subject.ts";

describe("subject-pos conformance", () => {
  test("layout + manifest", () => {
    assert_kirlet_conformance({
      definition: SUBJECT,
      src_dir: join(import.meta.dir),
    });
  });

  test("health and CRUD", async () => {
    const server = create_kirlet_test_context(SUBJECT);
    const h = await server.fetch(new Request("http://t/health"));
    expect(h.status).toBe(200);
    const c = await server.fetch(
      new Request("http://t/pos-session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "A" }),
      }),
    );
    expect(c.status).toBe(201);
    const menu = SUBJECT.manifest().menu ?? [];
    expect(menu.length).toBeGreaterThan(0);
    server.stop();
  });

  test("cada leaf crud apunta a una ruta de listado existente", async () => {
    const server = create_kirlet_test_context(SUBJECT);
    const pages = SUBJECT.manifest().pages ?? [];
    const leaves = pages
      .map((p: { leaf?: { kind?: string; appBase?: string } }) => p.leaf)
      .filter((l) => l?.kind === "crud" && l.appBase);
    expect(leaves.length).toBeGreaterThan(0);
    for (const leaf of leaves) {
      const r = await server.fetch(new Request(`http://t/${leaf!.appBase}`));
      expect({ appBase: leaf!.appBase, status: r.status }).toEqual({
        appBase: leaf!.appBase,
        status: 200,
      });
    }
    server.stop();
  });
});
