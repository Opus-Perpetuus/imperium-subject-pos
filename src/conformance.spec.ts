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

  // Core 7315462c9: field-values de un campo que la tabla no tiene es 400.
  // El menú de cabecera de cada lista pide field-values por columna; ninguna
  // columna declarada puede tumbar el servidor.
  test("field-values de cada columna de leaf crud no responde 5xx", async () => {
    const server = create_kirlet_test_context(SUBJECT);
    const leaves = (SUBJECT.manifest().pages ?? [])
      .map((p: { leaf?: { kind?: string; appBase?: string; listHeaders?: Record<string, unknown> } }) => p.leaf)
      .filter((l) => l?.kind === "crud" && l.appBase);
    expect(leaves.length).toBeGreaterThan(0);
    for (const leaf of leaves) {
      for (const column of Object.keys(leaf!.listHeaders ?? {})) {
        const url = `http://t/${leaf!.appBase}/field-values/${column}`;
        const r = await server.fetch(new Request(url));
        expect({ url, server_error: r.status >= 500 }).toEqual({ url, server_error: false });
      }
      // Antes llegaba al SQL (500 en Postgres, 200 vacío en el contexto de prueba).
      // 404 = ruta propia sin field-values; nunca 200 ni 5xx.
      const url = `http://t/${leaf!.appBase}/field-values/__no_existe__`;
      const r = await server.fetch(new Request(url));
      expect({ url, rejected: r.status === 400 || r.status === 404 }).toEqual({ url, rejected: true });
    }
    server.stop();
  });
});
