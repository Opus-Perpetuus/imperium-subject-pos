import { describe, expect, test } from "bun:test";
import {
  create_kirlet_test_context,
  MemoryKirletDataClient,
  sign_kirlet_identity,
  sign_kirlet_identity_v2,
} from "@opus-perpetuus/imperium-core-kit";
import { SUBJECT } from "./subject.ts";

// No-fuga: field-values nunca devuelve blobs json ni campos sensibles de pos.
const MARCA = "FUGA-NO-DEBE-SALIR";
const blob = { token: MARCA, api_key: MARCA };
const SECRET = "pos-fv-secret";
// La PII (domicilio) solo sale con sesión interna; credenciales y json nunca.
const PII = new Set(["partner_home", "client_home"]);
const base_id = { user_id: "u-1", email: "u@x.mx", is_admin: true, kirlet_id: SUBJECT.technical_id, grants: [] };
const externo = () => sign_kirlet_identity_v2({ ...base_id, user_type: "external", realm: "public" }, SECRET);
const interno = () => sign_kirlet_identity(base_id, SECRET);

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
      const server = create_kirlet_test_context(SUBJECT, { data, auth_disabled: true, gateway_secret: SECRET });
      try {
        for (const campo of c.denegados) {
          const res = await server.fetch(new Request(`http://t/${c.base}/field-values/${campo}?termino=`, { headers: externo() }));
          const texto = await res.text();
          expect({ campo, status: res.status }).toEqual({ campo, status: 400 });
          expect(texto).not.toContain(MARCA);
          const con_sesion = await server.fetch(new Request(`http://t/${c.base}/field-values/${campo}?termino=`, { headers: interno() }));
          expect({ campo, status: con_sesion.status }).toEqual({ campo, status: PII.has(campo) ? 200 : 400 });
        }
        const ok = await server.fetch(new Request(`http://t/${c.base}/field-values/name?termino=`, { headers: externo() }));
        expect(ok.status).toBe(200);
        const body = (await ok.json()) as { data: Array<{ value: unknown }> };
        expect(body.data.map((d) => d.value)).toContain("Fila uno");
      } finally {
        await server.stop?.();
      }
    });
  }
});
