import { describe, expect, test } from "bun:test";
import { create_kirlet_test_context } from "@opus-perpetuus/imperium-core-kit";
import { SUBJECT } from "../../subject.ts";
import { apply_promotions, type PromotionRule, type SaleLine } from "./pos-promotion.logic.ts";

const NOW = new Date("2026-06-15T12:00:00.000Z");

function line(partial: Partial<SaleLine> & Pick<SaleLine, "quantity">): SaleLine {
  return {
    product_id: partial.product_id ?? "prod-1",
    quantity: partial.quantity,
    unit_price: partial.unit_price ?? 10,
  };
}

function promo(partial: PromotionRule): PromotionRule {
  return {
    id: "promo-1",
    product_id: "prod-1",
    is_active: true,
    priority: 0,
    ...partial,
  };
}

describe("apply_promotions", () => {
  test("2x1 con 2, 3 y 4 piezas", () => {
    const rules = [promo({ id: "nxm", kind: "nxm", buy_qty: 2, pay_qty: 1 })];
    const two = apply_promotions([line({ quantity: 2 })], rules, NOW);
    expect(two.lines[0]).toMatchObject({ discount: 10, total: 10, promotion_id: "nxm" });
    const three = apply_promotions([line({ quantity: 3 })], rules, NOW);
    expect(three.lines[0]).toMatchObject({ discount: 10, total: 20, promotion_id: "nxm" });
    const four = apply_promotions([line({ quantity: 4 })], rules, NOW);
    expect(four.lines[0]).toMatchObject({ discount: 20, total: 20, promotion_id: "nxm" });
    expect(four.total).toBe(20);
    expect(four.discount_total).toBe(20);
  });

  test("mayoreo debajo y arriba del mínimo", () => {
    const rules = [promo({ id: "may", kind: "mayoreo", min_qty: 6, unit_price: 8 })];
    const below = apply_promotions([line({ quantity: 5, unit_price: 10 })], rules, NOW);
    expect(below.lines[0]).toMatchObject({ discount: 0, total: 50, promotion_id: null });
    const above = apply_promotions([line({ quantity: 6, unit_price: 10 })], rules, NOW);
    expect(above.lines[0]).toMatchObject({ discount: 12, total: 48, promotion_id: "may" });
  });

  test("descuento porcentaje y monto", () => {
    const percent = apply_promotions(
      [line({ quantity: 2, unit_price: 50 })],
      [promo({ id: "pct", kind: "descuento", percent: 10 })],
      NOW,
    );
    expect(percent.lines[0]).toMatchObject({ discount: 10, total: 90, promotion_id: "pct" });

    const amount = apply_promotions(
      [line({ quantity: 2, unit_price: 20 })],
      [promo({ id: "amt", kind: "descuento", amount: 5 })],
      NOW,
    );
    expect(amount.lines[0]).toMatchObject({ discount: 10, total: 30, promotion_id: "amt" });
  });

  test("promo vencida o futura se ignora", () => {
    const rules = [
      promo({
        id: "vieja",
        kind: "descuento",
        percent: 50,
        ends_at: "2026-06-01T00:00:00.000Z",
      }),
      promo({
        id: "futura",
        kind: "descuento",
        percent: 50,
        starts_at: "2026-07-01T00:00:00.000Z",
      }),
      promo({ id: "off", kind: "descuento", percent: 50, is_active: false }),
    ];
    const quote = apply_promotions([line({ quantity: 1, unit_price: 40 })], rules, NOW);
    expect(quote.lines[0]).toMatchObject({ discount: 0, total: 40, promotion_id: null });
    expect(quote.total).toBe(40);
  });

  test("dos promos: gana la de mayor ahorro", () => {
    const rules = [
      promo({ id: "nxm", kind: "nxm", buy_qty: 2, pay_qty: 1, priority: 5 }),
      promo({ id: "pct", kind: "descuento", percent: 60, priority: 1 }),
    ];
    const quote = apply_promotions([line({ quantity: 4, unit_price: 10 })], rules, NOW);
    expect(quote.lines[0]).toMatchObject({ discount: 24, total: 16, promotion_id: "pct" });
  });

  test("descuento mayor al precio deja el total en 0", () => {
    const quote = apply_promotions(
      [line({ quantity: 1, unit_price: 10 })],
      [promo({ id: "grande", kind: "descuento", amount: 25 })],
      NOW,
    );
    expect(quote.lines[0]).toMatchObject({ discount: 10, total: 0, promotion_id: "grande" });
    expect(quote.total).toBe(0);
  });
});

describe("pos-promotion HTTP", () => {
  test("POST /pos-promotion/apply y el ticket guardan el descuento", async () => {
    const server = create_kirlet_test_context(SUBJECT);
    const created = await server.fetch(
      new Request("http://t/pos-promotion", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "2x1 café",
          kind: "nxm",
          product_id: "cafe",
          buy_qty: 2,
          pay_qty: 1,
          is_active: true,
        }),
      }),
    );
    expect(created.status).toBe(201);
    const promo_id = ((await created.json()) as { data: { id: string } }).data.id;

    const applied = await server.fetch(
      new Request("http://t/pos-promotion/apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items: [{ product_id: "cafe", quantity: 2, unit_price: 15 }],
        }),
      }),
    );
    expect(applied.status).toBe(200);
    const quote = (await applied.json()) as {
      data: { total: number; discount_total: number; lines: Array<{ promotion_id: string }> };
    };
    expect(quote.data.total).toBe(15);
    expect(quote.data.discount_total).toBe(15);
    expect(quote.data.lines[0]?.promotion_id).toBe(promo_id);

    const ticket = await server.fetch(
      new Request("http://t/pos-tickets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "T-1",
          payload: {
            items: [
              { product_id: "cafe", quantity: 2, unit_price: 15 },
              { product_id: "agua", quantity: 1, unit_price: 10 },
            ],
          },
        }),
      }),
    );
    expect(ticket.status).toBe(201);
    const row = ((await ticket.json()) as { data: Record<string, unknown> }).data;
    expect(row.discount_total).toBe(15);
    const items = (row.payload as { items: Array<Record<string, unknown>> }).items;
    expect(items[0]).toMatchObject({
      discount: 15,
      total: 15,
      price_origin: "promocion",
      promotion_id: promo_id,
    });
    expect(items[1]?.price_origin).toBeUndefined();
    expect(items[1]).toMatchObject({ discount: 0, total: 10, promotion_id: null });
    server.stop();
  });
});
