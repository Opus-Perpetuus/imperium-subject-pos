import { describe, expect, test } from "bun:test";
import { create_kirlet_test_context } from "@opus-perpetuus/imperium-core-kit";
import { SUBJECT } from "../../subject.ts";
import { aplicar_abono, validar_venta_credito } from "./pos-credit.logic.ts";

describe("crédito (lógica)", () => {
  test("cargo suma al saldo", () => {
    const plan = validar_venta_credito({
      client_id: "cli-1",
      credit_amount: 25.5,
      balance: 10,
      credit_limit: 100,
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.movimiento.kind).toBe("cargo");
    expect(plan.movimiento.amount).toBe(25.5);
    expect(plan.balance_after).toBe(35.5);
  });

  test("límite cero no toca el cargo", () => {
    const plan = validar_venta_credito({
      client_id: "cli-1",
      credit_amount: 5000,
      balance: 0,
      credit_limit: 0,
    });
    expect(plan.ok).toBe(true);
  });

  test("límite excedido", () => {
    const plan = validar_venta_credito({
      client_id: "cli-1",
      credit_amount: 30,
      balance: 80,
      credit_limit: 100,
    });
    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.mensaje).toContain("límite");
  });

  test("abono baja el saldo", () => {
    const plan = aplicar_abono(40, 15);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.movimiento.kind).toBe("abono");
    expect(plan.balance_after).toBe(25);
  });

  test("abono igual al saldo lo deja en cero", () => {
    const plan = aplicar_abono(10, 10);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.balance_after).toBe(0);
  });

  test("abono mayor al saldo", () => {
    const plan = aplicar_abono(10, 10.01);
    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.mensaje).toContain("negativo");
  });

  test("venta a crédito sin cliente", () => {
    const plan = validar_venta_credito({
      client_id: "  ",
      credit_amount: 20,
      balance: 0,
      credit_limit: 100,
    });
    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.mensaje).toContain("cliente");
  });
});

describe("crédito (CRUD)", () => {
  test("ticket a crédito, límite, abono y estado de cuenta", async () => {
    const server = create_kirlet_test_context(SUBJECT);
    const post = (path: string, body: unknown) =>
      server.fetch(
        new Request(`http://t${path}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
      );

    try {
      const cuenta = await post("/pos-credit-account", {
        name: "Fiado Ana",
        client_id: "ana",
        client_name: "Ana",
        credit_limit: 100,
        balance: 0,
      });
      expect(cuenta.status).toBe(201);
      const cuenta_body = (await cuenta.json()) as { data: { id: string; balance: number } };
      const account_id = cuenta_body.data.id;

      const sin_cliente = await post("/pos-tickets", {
        name: "T-sin",
        is_credit: true,
        credit_amount: 10,
      });
      expect(sin_cliente.status).toBe(400);

      const excedido = await post("/pos-tickets", {
        name: "T-excede",
        is_credit: true,
        client_id: "ana",
        credit_amount: 150,
      });
      expect(excedido.status).toBe(400);

      const venta = await post("/pos-tickets", {
        name: "T-1",
        is_credit: true,
        client_id: "ana",
        client_name: "Ana",
        credit_amount: 60,
      });
      expect(venta.status).toBe(201);

      const estado1 = await server.fetch(new Request("http://t/pos-credit-account/estado/ana"));
      expect(estado1.status).toBe(200);
      const edo1 = (await estado1.json()) as {
        data: { balance: number; movements: Array<{ kind: string; amount: number }> };
      };
      expect(edo1.data.balance).toBe(60);
      expect(edo1.data.movements.map((m) => m.kind)).toEqual(["cargo"]);

      const abono_de_mas = await post(`/pos-credit-account/${account_id}/abono`, {
        amount: 80,
        note: "de más",
      });
      expect(abono_de_mas.status).toBe(400);

      const abono = await post(`/pos-credit-account/${account_id}/abono`, {
        amount: 20,
        note: "pago parcial",
      });
      expect(abono.status).toBe(200);
      const abono_body = (await abono.json()) as { data: { account: { balance: number } } };
      expect(abono_body.data.account.balance).toBe(40);

      const estado2 = await server.fetch(new Request("http://t/pos-credit-account/estado/ana"));
      const edo2 = (await estado2.json()) as {
        data: { balance: number; movements: Array<{ kind: string; balance_after: number }> };
      };
      expect(edo2.data.balance).toBe(40);
      expect(edo2.data.movements.map((m) => m.kind)).toEqual(["cargo", "abono"]);
      expect(edo2.data.movements[1]?.balance_after).toBe(40);

      const nueva = await post("/pos-tickets", {
        name: "T-nueva",
        is_credit: true,
        client_id: "beto",
        client_name: "Beto",
        credit_amount: 15,
      });
      expect(nueva.status).toBe(201);
      const estado_beto = await server.fetch(
        new Request("http://t/pos-credit-account/estado/beto"),
      );
      expect(estado_beto.status).toBe(200);
      const beto = (await estado_beto.json()) as { data: { balance: number } };
      expect(beto.data.balance).toBe(15);
    } finally {
      server.stop();
    }
  });
});
