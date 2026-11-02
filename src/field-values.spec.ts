import { describe, expect, test } from "bun:test";
import { create_kirlet_test_context, MemoryKirletDataClient } from "@opus-perpetuus/imperium-core-kit";
import { SUBJECT } from "./subject.ts";

// No-fuga: field-values nunca devuelve blobs json ni campos sensibles de pos.
const MARCA = "FUGA-NO-DEBE-SALIR";
const blob = { token: MARCA, api_key: MARCA };

const casos: Array<{ base: string; table: string; row: Record<string, unknown>; denegados: string[] }> = [
  { base: "pos", table: "pos", row: { partner_home: MARCA }, denegados: ["custom_data", "payload", "partner_home"] },
  { base: "pos-order", table: "pos_order", row: { partner_home: MARCA }, denegados: ["custom_data", "payload", "partner_home"] },
  { base: "pos-promotion", table: "pos_promotion", row: { kind: "nxm" }, denegados: ["custom_data", "payload"] },
  {
    base: "pos-session",
    table: "pos_session",
    row: { usage_history: blob, runtime_state: blob },
    denegados: ["custom_data", "payload", "usage_history", "runtime_state"],
  },
  {
    base: "pos-tickets",
    table: "pos_tickets",
    row: { payments: [blob], withdrawal_signature: `data:image/png;base64,${MARCA}`, reprint_log: [blob], client_home: MARCA },
    denegados: ["custom_data", "payload", "payments", "withdrawal_signature", "reprint_log", "client_home"],
  },
  {
    base: "pos-credit-account",
    table: "pos_credit_account",
    row: { client_id: "cli-1" },
    denegados: ["custom_data", "payload"],
  },
];

describe("field-values no fuga (pos)", () => {
  for (const c of casos) {
    test(`${c.base}: sensibles 400 sin valores; name 200`, async () => {
      const data = new MemoryKirletDataClient(SUBJECT.schema());
      await data.insert(c.table, {
        id: `${c.table}-1`,
        name: "Fila uno",
        is_active: true,
        custom_data: blob,
        payload: blob,
        ...c.row,
      });
      const server = create_kirlet_test_context(SUBJECT, { data });
      try {
        for (const campo of c.denegados) {
          const res = await server.fetch(new Request(`http://t/${c.base}/field-values/${campo}?termino=`));
          const texto = await res.text();
          expect({ campo, status: res.status }).toEqual({ campo, status: 400 });
          expect(texto).not.toContain(MARCA);
        }
        const ok = await server.fetch(new Request(`http://t/${c.base}/field-values/name?termino=`));
        expect(ok.status).toBe(200);
        const body = (await ok.json()) as { data: Array<{ value: unknown }> };
        expect(body.data.map((d) => d.value)).toContain("Fila uno");
      } finally {
        await server.stop?.();
      }
    });
  }
});
