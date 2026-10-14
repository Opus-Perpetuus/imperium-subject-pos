import { describe, expect, test, afterEach } from "bun:test";
import { create_kirlet_test_context } from "@opus-perpetuus/imperium-core-kit";
import { SUBJECT } from "../../subject.ts";
import {
  deduct_ticket_stock,
  extract_sold_lines,
  set_almacen_call,
  type AlmacenCall,
} from "./pos-tickets.stock.ts";

afterEach(() => {
  set_almacen_call(null);
});

describe("extract_sold_lines", () => {
  test("extrae payload.items y agrupa por producto", () => {
    const lines = extract_sold_lines({
      ticket_type: "venta",
      payload: {
        items: [
          { item_id: "prod-a", quantity: 2 },
          { product_id: "prod-b", quantity: "3" },
          { item_id: "prod-a", quantity: 1.5 },
          { item_id: "prod-c", quantity: 0 },
          { item_id: "prod-d", quantity: -2 },
          { item_id: "", quantity: 4 },
        ],
      },
    });
    expect(lines).toEqual([
      { product_id: "prod-a", quantity: 3.5 },
      { product_id: "prod-b", quantity: 3 },
    ]);
  });

  test("usa payload.lines si no hay items", () => {
    const lines = extract_sold_lines({
      payload: {
        lines: [{ product_id: "prod-z", quantity: 1 }],
      },
      item_id: "no-usar",
      quantity: 9,
    });
    expect(lines).toEqual([{ product_id: "prod-z", quantity: 1 }]);
  });

  test("cae al par plano item_id/quantity", () => {
    expect(extract_sold_lines({ item_id: "prod-x", quantity: 4 })).toEqual([
      { product_id: "prod-x", quantity: 4 },
    ]);
  });

  test("ignora retiro y withdrawal", () => {
    const payload = { items: [{ item_id: "prod-a", quantity: 2 }] };
    expect(extract_sold_lines({ ticket_type: "retiro", payload })).toEqual([]);
    expect(extract_sold_lines({ ticket_type: "Withdrawal", payload })).toEqual([]);
    expect(extract_sold_lines({ ticket_type: "RETIRO", item_id: "prod-a", quantity: 1 })).toEqual([]);
  });
});

type CallLog = { target: string; route: string; body?: unknown; query?: Record<string, string> };

function almacen_ok(log: CallLog[]): AlmacenCall {
  const quants = new Map<string, Record<string, unknown>>([
    [
      "prod-a",
      {
        id: "quant-1",
        producto_id: "prod-a",
        cantidad: 10,
        cantidad_apartada: 2,
        cantidad_disponible: 8,
      },
    ],
    [
      "prod-b",
      {
        id: "quant-b",
        producto_id: "prod-b",
        cantidad: 10,
        cantidad_apartada: 2,
        cantidad_disponible: 8,
      },
    ],
  ]);
  const products: Record<string, Record<string, unknown>> = {
    "prod-a": { id: "prod-a", name: "Agua", existencia: 10, existenciaApartada: 2 },
    "prod-b": { id: "prod-b", name: "Pan", existencia: 4, existenciaApartada: 0 },
  };
  return async (target, route, opts) => {
    log.push({ target, route, body: opts?.body, query: opts?.query });
    if (route.startsWith("POST /inventory-movement")) return { id: "mov-1" };
    if (route.startsWith("GET /inventory-stock-quant")) {
      const product_id = opts?.query?.q ?? "";
      const quant = quants.get(product_id);
      return quant ? [quant] : [];
    }
    if (route.startsWith("PATCH /inventory-stock-quant/")) {
      const id = decodeURIComponent(route.slice("PATCH /inventory-stock-quant/".length));
      const quant = [...quants.values()].find((row) => row.id === id);
      if (!quant) throw new Error(`quant ${id}`);
      Object.assign(quant, opts?.body);
      return quant;
    }
    if (route.startsWith("GET /products/")) {
      const id = decodeURIComponent(route.slice("GET /products/".length));
      const product = products[id];
      if (!product) throw new Error(`producto ${id}`);
      return product;
    }
    if (route.startsWith("PATCH /products/")) {
      const id = decodeURIComponent(route.slice("PATCH /products/".length));
      const product = products[id];
      if (!product) throw new Error(`producto ${id}`);
      Object.assign(product, opts?.body);
      return product;
    }
    throw new Error(`ruta no simulada: ${route}`);
  };
}

describe("deduct_ticket_stock", () => {
  test("registra salida, quant y existencia agrupados", async () => {
    const log: CallLog[] = [];
    const error = await deduct_ticket_stock(
      {
        id: "tick-1",
        name: "T-1",
        ref: "T-1",
        ticket_type: "venta",
        payload: {
          items: [
            { item_id: "prod-a", quantity: 2 },
            { item_id: "prod-a", quantity: 1 },
          ],
        },
      },
      almacen_ok(log),
    );
    expect(error).toBeNull();
    const movements = log.filter((call) => call.route === "POST /inventory-movement");
    expect(movements).toHaveLength(1);
    expect(movements[0]?.target).toBe("subject-almacen");
    expect(movements[0]?.body).toMatchObject({
      tipo_movimiento: "salida",
      producto_id: "prod-a",
      cantidad: 3,
      documento_id: "tick-1",
      documento_referencia: "T-1",
    });
    expect(log.some((call) => call.route === "GET /inventory-stock-quant")).toBe(true);
    const quant_patch = log.find((call) => call.route.startsWith("PATCH /inventory-stock-quant/"));
    expect(quant_patch?.body).toEqual({ cantidad: 7, cantidad_disponible: 5 });
    const product_patch = log.find((call) => call.route.startsWith("PATCH /products/"));
    expect(product_patch?.body).toEqual({ existencia: 7, existenciaDisponible: "5" });
  });

  test("un retiro no llama a almacén", async () => {
    const log: CallLog[] = [];
    const error = await deduct_ticket_stock(
      {
        id: "tick-r",
        ticket_type: "retiro",
        payload: { items: [{ item_id: "prod-a", quantity: 1 }] },
      },
      almacen_ok(log),
    );
    expect(error).toBeNull();
    expect(log).toHaveLength(0);
  });

  test("el fallo de almacén no se propaga", async () => {
    const error = await deduct_ticket_stock(
      {
        id: "tick-2",
        ticket_type: "venta",
        item_id: "prod-a",
        quantity: 1,
      },
      async () => {
        throw new Error("almacén caído");
      },
    );
    expect(error).toContain("prod-a");
    expect(error).toContain("almacén caído");
  });
});

describe("after_create del ticket", () => {
  test("la venta sigue en 201 y guarda stock_error", async () => {
    const logged: string[] = [];
    const original = console.error;
    console.error = (...parts: unknown[]) => {
      logged.push(parts.map(String).join(" "));
    };
    set_almacen_call(async () => {
      throw new Error("almacén caído");
    });
    const server = create_kirlet_test_context(SUBJECT);
    try {
      const created = await server.fetch(
        new Request("http://t/pos-tickets", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: "Venta 1",
            ticket_type: "venta",
            payload: { items: [{ item_id: "prod-a", quantity: 2 }] },
          }),
        }),
      );
      expect(created.status).toBe(201);
      const body = (await created.json()) as { data: { id: string } };
      const loaded = await server.fetch(new Request(`http://t/pos-tickets/${body.data.id}`));
      expect(loaded.status).toBe(200);
      const row = (await loaded.json()) as {
        data: { state: string; custom_data: { stock_error?: string } };
      };
      expect(row.data.state).toBe("stock_error");
      expect(row.data.custom_data.stock_error).toContain("almacén caído");
      expect(logged.some((line) => line.includes("almacén caído"))).toBe(true);
    } finally {
      console.error = original;
      server.stop();
    }
  });

  test("el hook descuenta con la llamada inyectada", async () => {
    const log: CallLog[] = [];
    set_almacen_call(almacen_ok(log));
    const server = create_kirlet_test_context(SUBJECT);
    try {
      const created = await server.fetch(
        new Request("http://t/pos-tickets", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: "Venta 2",
            ref: "POS-2",
            ticket_type: "sale",
            payload: {
              lines: [
                { product_id: "prod-b", quantity: 1 },
                { item_id: "prod-b", quantity: 1 },
              ],
            },
          }),
        }),
      );
      expect(created.status).toBe(201);
      const body = (await created.json()) as { data: { id: string; state: string | null } };
      expect(body.data.state ?? null).not.toBe("stock_error");
      const movements = log.filter((call) => call.route === "POST /inventory-movement");
      expect(movements).toHaveLength(1);
      expect(movements[0]?.body).toMatchObject({
        tipo_movimiento: "salida",
        producto_id: "prod-b",
        cantidad: 2,
        documento_referencia: "POS-2",
      });
      expect(log.some((call) => call.route.startsWith("PATCH /products/"))).toBe(true);
    } finally {
      server.stop();
    }
  });
});
