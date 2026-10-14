import {
  define_crud,
  define_module,
  type DomainRow,
  type KirletCtx,
  type KirletRouteTable,
} from "@opus-perpetuus/imperium-core-kit";
import { apply_promotions, type PromotionRule } from "../pos-promotion/pos-promotion.logic.ts";
import { pos_tickets_pages } from "./pos-tickets.pages.ts";
import { pos_tickets_tables } from "./pos-tickets.tables.ts";

/**
 * El CRUD solo copia `payload` cuando el body trae un campo desconocido.
 * Esta marca fuerza ese camino y el hook la quita antes de guardar.
 */
const PAYLOAD_MARK = "__keep_payload";

function payload_object(payload: unknown): Record<string, unknown> | null {
  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload);
    } catch {
      return null;
    }
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  return payload as Record<string, unknown>;
}

function without_mark(payload: Record<string, unknown>): Record<string, unknown> {
  if (!(PAYLOAD_MARK in payload)) return payload;
  const { [PAYLOAD_MARK]: _mark, ...clean } = payload;
  return clean;
}

/** Recalcula renglones de payload.items. Si no se pueden leer las promos, la venta sigue. */
async function apply_ticket_promotions(ctx: KirletCtx, row: DomainRow): Promise<DomainRow> {
  const payload = payload_object(row.payload);
  if (!payload) return row;
  const clean = without_mark(payload);
  const items = clean.items;
  if (!Array.isArray(items) || items.length === 0) {
    return clean === payload ? row : { ...row, payload: clean };
  }
  try {
    const promos = (await ctx.data.findMany("pos_promotion", {})) as PromotionRule[];
    const quote = apply_promotions(
      items.map((raw) => {
        const item = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
        return {
          product_id: String(item.product_id ?? item.item_id ?? ""),
          quantity: Number(item.quantity ?? 0),
          unit_price: Number(item.unit_price ?? 0),
        };
      }),
      promos,
      new Date(),
    );
    const next_items = items.map((raw, index) => {
      const item = raw && typeof raw === "object" ? { ...(raw as Record<string, unknown>) } : {};
      const priced = quote.lines[index];
      if (!priced) return item;
      item.discount = priced.discount;
      item.total = priced.total;
      item.promotion_id = priced.promotion_id;
      if (priced.discount > 0) item.price_origin = "promocion";
      return item;
    });
    return {
      ...row,
      discount_total: quote.discount_total,
      payload: { ...clean, items: next_items },
    };
  } catch {
    return clean === payload ? row : { ...row, payload: clean };
  }
}

function keep_payload_on_create(routes: KirletRouteTable): KirletRouteTable {
  return routes.map((route) => {
    if (route.pattern !== "POST /pos-tickets" || route.raw) return route;
    const inner = route.handler as (ctx: KirletCtx) => Promise<unknown>;
    return {
      ...route,
      handler: async (ctx: KirletCtx) => {
        const body = (await ctx.body<Record<string, unknown>>()) ?? {};
        const payload = body.payload;
        const next =
          payload && typeof payload === "object" && !Array.isArray(payload)
            ? { ...body, [PAYLOAD_MARK]: true }
            : body;
        return inner({ ...ctx, body: async () => next });
      },
    };
  });
}

export const pos_tickets_module = define_module({
  resource: "pos-tickets",
  labels: {
    singular: "Tickets",
    plural: "Tickets",
    read: "Ver Tickets",
    write: "Editar Tickets",
  },
  routes: keep_payload_on_create(define_crud({
    resource: "pos-tickets",
    table: "pos_tickets",
    soft_delete: true,
    soft_delete_field: "is_active",
    history: true,
    default_sort: "name:asc",
    id_prefix: "pos-tick",
    // Sin esto el CRUD descarta `payload` y no llegan los renglones.
    unknown_to_payload: true,
    fields: {
      name: { type: "string", required: true, search: true },
      description: { type: "string", search: true },
      is_active: { type: "boolean" },
      state: { type: "string" },
      ref: { type: "string", search: true },
      search_field: { type: "string", search: true },
      created_by: { type: "string" },
      custom_data: { type: "json" },
      payload: { type: "json" },
      ticket_sequence: { type: "string", search: true },
      ticket_type: { type: "string", search: true },
      pos_session: { type: "string", search: true },
      subtotal: { type: "number" },
      discount_total: { type: "number" },
      total_paid: { type: "number" },
      change: { type: "number" },
      client_id: { type: "string", search: true },
      client_name: { type: "string", search: true },
      client_lastname: { type: "string", search: true },
      client_home: { type: "string", search: true },
      items: { type: "string", search: true },
      item_id: { type: "string", search: true },
      quantity: { type: "number" },
      total: { type: "number" },
      unit_price: { type: "number" },
      price_origin: { type: "string", search: true },
      withdrawal_amount: { type: "number" },
      withdrawal_reason: { type: "string", search: true },
      withdrawal_signature: { type: "string", search: true },
    },
    options_map: { value: "id", label: "name" },
    hooks: {
      before_create: apply_ticket_promotions,
    },
  })),
  tables: pos_tickets_tables,
  pages: pos_tickets_pages,
  menu: [],
});
