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

function almacen_ok(
  log: CallLog[],
  seed?: {
    cantidad?: number;
    apartada?: number;
    existencia?: number;
    existenciaApartada?: number;
    movements?: Record<string, unknown>[];
  },
): AlmacenCall {
  const cantidad = seed?.cantidad ?? 10;
  const apartada = seed?.apartada ?? 2;
  const existencia = seed?.existencia ?? 10;
  const existenciaApartada = seed?.existenciaApartada ?? 2;
  const quants = new Map<string, Record<string, unknown>>([
    [
      "prod-a",
      {
        id: "quant-1",
        producto_id: "prod-a",
        cantidad,
        cantidad_apartada: apartada,
        cantidad_disponible: cantidad - apartada,
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
    "prod-a": { id: "prod-a", name: "Agua", existencia, existenciaApartada },
    "prod-b": { id: "prod-b", name: "Pan", existencia: 4, existenciaApartada: 0 },
  };
  const movements: Record<string, unknown>[] = [...(seed?.movements ?? [])];
  return async (target, route, opts) => {
    log.push({ target, route, body: opts?.body, query: opts?.query });
    if (route.startsWith("GET /inventory-movement")) {
      const ref = opts?.query?.documento_referencia ?? "";
      const product_id = opts?.query?.producto_id ?? "";
      return movements.filter((movement) => {
        const doc = String(movement.documento_referencia ?? "");
        const product = String(movement.producto_id ?? movement.producto ?? "");
        return (!ref || doc === ref) && (!product_id || product === product_id);
      });
    }
    if (route.startsWith("POST /inventory-movement")) {
      const body = (opts?.body ?? {}) as Record<string, unknown>;
      const created = { id: `mov-${movements.length + 1}`, ...body };
      movements.push(created);
      return created;
    }
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
        data: { custom_data: { stock_status?: string; stock_error?: string } };
      };
      expect(row.data.custom_data.stock_status).toBe("pending");
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
      const body = (await created.json()) as {
        data: { id: string; state: string | null; custom_data?: { stock_status?: string } };
      };
      expect(body.data.state ?? null).not.toBe("stock_error");
      const loaded = await server.fetch(new Request(`http://t/pos-tickets/${body.data.id}`));
      const saved = (await loaded.json()) as {
        data: { custom_data: { stock_status?: string; stock_applied_at?: string } };
      };
      expect(saved.data.custom_data.stock_status).toBe("applied");
      expect(typeof saved.data.custom_data.stock_applied_at).toBe("string");
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

describe("descuento que no bloquea la venta", () => {
  test("stock insuficiente deja quant y existencia en negativo", async () => {
    const log: CallLog[] = [];
    set_almacen_call(almacen_ok(log, {
      cantidad: 1,
      apartada: 1,
      existencia: 1,
      existenciaApartada: 1,
    }));
    const server = create_kirlet_test_context(SUBJECT);
    try {
      const created = await server.fetch(
        new Request("http://t/pos-tickets", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: "Venta sin stock",
            ref: "NEG-1",
            ticket_type: "venta",
            payload: { items: [{ item_id: "prod-a", quantity: 3 }] },
          }),
        }),
      );
      expect(created.status).toBe(201);
      const quant_patch = log.find((call) => call.route.startsWith("PATCH /inventory-stock-quant/"));
      expect(quant_patch?.body).toEqual({ cantidad: -2, cantidad_disponible: -3 });
      const product_patch = log.find((call) => call.route.startsWith("PATCH /products/"));
      expect(product_patch?.body).toEqual({ existencia: -2, existenciaDisponible: "-3" });
      const body = (await created.json()) as { data: { id: string } };
      const loaded = await server.fetch(new Request(`http://t/pos-tickets/${body.data.id}`));
      const row = (await loaded.json()) as { data: { custom_data: { stock_status?: string } } };
      expect(row.data.custom_data.stock_status).toBe("applied");
    } finally {
      server.stop();
    }
  });

  test("reenviar el mismo ticket no duplica ni vuelve a descontar", async () => {
    const log: CallLog[] = [];
    set_almacen_call(almacen_ok(log));
    const server = create_kirlet_test_context(SUBJECT);
    const venta = {
      name: "Venta offline",
      ref: "OFF-1",
      pos_session: "sess-1",
      ticket_sequence: "7",
      ticket_type: "venta",
      payload: { items: [{ item_id: "prod-a", quantity: 2 }] },
    };
    const sin_ref = {
      name: "Venta sin ref",
      pos_session: "sess-9",
      ticket_sequence: "3",
      ticket_type: "venta",
      payload: { items: [{ item_id: "prod-b", quantity: 1 }] },
    };
    const post = (body: unknown) => server.fetch(
      new Request("http://t/pos-tickets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
    try {
      const first = await post(venta);
      const again = await post(venta);
      expect(first.status).toBe(201);
      expect(again.status).toBe(200);
      const a = (await first.json()) as { data: { id: string } };
      const b = (await again.json()) as { data: { id: string } };
      expect(b.data.id).toBe(a.data.id);

      const seq_first = await post(sin_ref);
      const seq_again = await post(sin_ref);
      expect(seq_first.status).toBe(201);
      expect(seq_again.status).toBe(200);
      const c = (await seq_first.json()) as { data: { id: string } };
      const d = (await seq_again.json()) as { data: { id: string } };
      expect(d.data.id).toBe(c.data.id);

      const listed = await server.fetch(new Request("http://t/pos-tickets"));
      const list = (await listed.json()) as { total_elementos: number };
      expect(list.total_elementos).toBe(2);
      expect(log.filter((call) => call.route === "POST /inventory-movement")).toHaveLength(2);
      expect(log.filter((call) => call.route.startsWith("PATCH /products/"))).toHaveLength(2);
    } finally {
      server.stop();
    }
  });
});

describe("idempotencia del movimiento y sync-stock", () => {
  test("un movimiento ya existente no vuelve a ajustar quant ni existencia", async () => {
    const log: CallLog[] = [];
    const error = await deduct_ticket_stock(
      {
        id: "tick-ya",
        name: "T",
        ref: "YA-1",
        ticket_type: "venta",
        payload: { items: [{ item_id: "prod-a", quantity: 4 }] },
      },
      almacen_ok(log, {
        movements: [{
          id: "mov-previo",
          documento_referencia: "YA-1",
          producto_id: "prod-a",
          cantidad: 4,
          dedupe_key: "pos-ticket:YA-1:prod-a",
        }],
      }),
    );
    expect(error).toBeNull();
    expect(log.some((call) => call.route === "POST /inventory-movement")).toBe(false);
    expect(log.some((call) => call.route.startsWith("PATCH /"))).toBe(false);
  });

  test("almacén caído deja pending y sync aplica una sola vez", async () => {
    let down = true;
    const log: CallLog[] = [];
    const ok = almacen_ok(log);
    set_almacen_call(async (target, route, opts) => {
      if (down) throw new Error("almacén caído");
      return ok(target, route, opts);
    });
    const server = create_kirlet_test_context(SUBJECT);
    const post_ticket = (ref: string) => server.fetch(
      new Request("http://t/pos-tickets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: ref,
          ref,
          ticket_type: "venta",
          payload: { items: [{ item_id: "prod-a", quantity: 2 }] },
        }),
      }),
    );
    const sync = async (path: string) => {
      const response = await server.fetch(new Request(`http://t${path}`, { method: "POST" }));
      expect(response.status).toBe(200);
      return response.json() as Promise<{ applied: number; skipped: number; failed: number }>;
    };
    try {
      const created_a = await post_ticket("SYNC-A");
      const created_b = await post_ticket("SYNC-B");
      expect(created_a.status).toBe(201);
      expect(created_b.status).toBe(201);
      const ticket_a = (await created_a.json()) as { data: { id: string } };
      const ticket_b = (await created_b.json()) as { data: { id: string } };
      const pending = await server.fetch(new Request(`http://t/pos-tickets/${ticket_a.data.id}`));
      const pending_row = (await pending.json()) as {
        data: { custom_data: { stock_status?: string } };
      };
      expect(pending_row.data.custom_data.stock_status).toBe("pending");
      expect(log.filter((call) => call.route === "POST /inventory-movement")).toHaveLength(0);

      down = false;
      const by_id = await sync(`/pos-tickets/${ticket_a.data.id}/sync-stock`);
      expect(by_id).toEqual({ applied: 1, skipped: 0, failed: 0 });
      const bulk = await sync("/pos-tickets/sync-stock");
      expect(bulk).toEqual({ applied: 1, skipped: 1, failed: 0 });
      expect(log.filter((call) => call.route === "POST /inventory-movement")).toHaveLength(2);

      const again = await sync("/pos-tickets/sync-stock");
      expect(again).toEqual({ applied: 0, skipped: 2, failed: 0 });
      const again_id = await sync(`/pos-tickets/${ticket_b.data.id}/sync-stock`);
      expect(again_id).toEqual({ applied: 0, skipped: 1, failed: 0 });
      expect(log.filter((call) => call.route === "POST /inventory-movement")).toHaveLength(2);
      expect(log.filter((call) => call.route.startsWith("PATCH /products/"))).toHaveLength(2);

      const applied = await server.fetch(new Request(`http://t/pos-tickets/${ticket_a.data.id}`));
      const applied_row = (await applied.json()) as {
        data: { custom_data: { stock_status?: string; stock_applied_at?: string } };
      };
      expect(applied_row.data.custom_data.stock_status).toBe("applied");
      expect(typeof applied_row.data.custom_data.stock_applied_at).toBe("string");
    } finally {
      server.stop();
    }
  });
});
