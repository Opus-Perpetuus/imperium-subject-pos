import { describe, expect, test } from "bun:test";
import { KirletHttpError } from "@opus-perpetuus/imperium-core-kit";
import { normalize_payments } from "./pos-tickets.payments.ts";

describe("normalize_payments", () => {
  test("efectivo con cambio", () => {
    const row = normalize_payments({
      total: 80,
      payments: [{ method: "efectivo", amount: 100 }],
    });
    expect(row.payment_method).toBe("efectivo");
    expect(row.payments).toEqual([{ method: "efectivo", amount: 100 }]);
    expect(row.cash_amount).toBe(100);
    expect(row.card_amount).toBe(0);
    expect(row.transfer_amount).toBe(0);
    expect(row.total_paid).toBe(100);
    expect(row.change).toBe(20);
  });

  test("tarjeta exacta", () => {
    const row = normalize_payments({
      total: 250,
      payments: [{ method: "tarjeta", amount: 250 }],
    });
    expect(row.payment_method).toBe("tarjeta");
    expect(row.card_amount).toBe(250);
    expect(row.cash_amount).toBe(0);
    expect(row.transfer_amount).toBe(0);
    expect(row.total_paid).toBe(250);
    expect(row.change).toBe(0);
    expect(row.payment_reference).toBeNull();
  });

  test("transferencia con referencia", () => {
    const row = normalize_payments({
      total: 400,
      payments: [{ method: "transferencia", amount: 400, reference: "FOLIO-1" }],
    });
    expect(row.payment_method).toBe("transferencia");
    expect(row.transfer_amount).toBe(400);
    expect(row.payment_reference).toBe("FOLIO-1");
    expect(row.payments).toEqual([
      { method: "transferencia", amount: 400, reference: "FOLIO-1" },
    ]);
    expect(row.total_paid).toBe(400);
    expect(row.change).toBe(0);
  });

  test("mixto", () => {
    const row = normalize_payments({
      total: 100,
      payments: [
        { method: "efectivo", amount: 50 },
        { method: "tarjeta", amount: 60 },
        { method: "transferencia", amount: 20, reference: "SPEI-9" },
      ],
    });
    expect(row.payment_method).toBe("mixto");
    expect(row.cash_amount).toBe(50);
    expect(row.card_amount).toBe(60);
    expect(row.transfer_amount).toBe(20);
    expect(row.total_paid).toBe(130);
    expect(row.change).toBe(30);
    expect(row.payment_reference).toBe("SPEI-9");

    const suelto = normalize_payments({
      total: 100,
      cash_amount: 40,
      card_amount: 60,
      payment_reference: "AUTH-2",
    });
    expect(suelto.payment_method).toBe("mixto");
    expect(suelto.payments).toEqual([
      { method: "efectivo", amount: 40 },
      { method: "tarjeta", amount: 60, reference: "AUTH-2" },
    ]);
    expect(suelto.total_paid).toBe(100);
    expect(suelto.change).toBe(0);
    expect(suelto.payment_reference).toBe("AUTH-2");
  });

  test("tarjeta mayor al total", () => {
    expect(() =>
      normalize_payments({
        total: 100,
        payments: [{ method: "tarjeta", amount: 100.01 }],
      }),
    ).toThrow(KirletHttpError);
    try {
      normalize_payments({
        total: 80,
        card_amount: 50,
        transfer_amount: 40,
      });
      throw new Error("debió fallar");
    } catch (err) {
      expect(err).toBeInstanceOf(KirletHttpError);
      expect(err).toMatchObject({ status: 400, code: "validation_error" });
    }
  });

  test("método desconocido", () => {
    try {
      normalize_payments({
        total: 10,
        payments: [{ method: "crypto", amount: 10 }],
      });
      throw new Error("debió fallar");
    } catch (err) {
      expect(err).toBeInstanceOf(KirletHttpError);
      expect((err as KirletHttpError).status).toBe(400);
      expect((err as KirletHttpError).message).toContain("desconocido");
    }
  });

  test("ticket viejo sin payments", () => {
    const row = normalize_payments({
      name: "T-1",
      total_paid: 90,
      change: 10,
    });
    expect(row.payment_method).toBe("efectivo");
    expect(row.payments).toEqual([{ method: "efectivo", amount: 90 }]);
    expect(row.cash_amount).toBe(90);
    expect(row.card_amount).toBe(0);
    expect(row.transfer_amount).toBe(0);
    expect(row.total_paid).toBe(90);
    expect(row.change).toBe(10);
    expect(row.name).toBe("T-1");
  });
});
