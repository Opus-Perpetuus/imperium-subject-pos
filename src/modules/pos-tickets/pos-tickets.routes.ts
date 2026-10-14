import {
  define_crud,
  define_module,
  define_routes,
  KirletHttpError,
  type KirletCtx,
  type KirletRouteTable,
} from "@opus-perpetuus/imperium-core-kit";
import { pos_tickets_pages } from "./pos-tickets.pages.ts";
import {
  pos_tickets_after_create,
  pos_tickets_before_create,
  remember_ticket_payload,
  sync_pos_tickets_stock,
  TicketYaExiste,
  find_ticket_por_clave,
} from "./pos-tickets.stock.ts";
import { pos_tickets_tables } from "./pos-tickets.tables.ts";

/**
 * Conserva `payload` y, si `before_create` reconoce la misma clave,
 * responde el ticket ya guardado sin insertar ni volver a descontar.
 */
function keep_ticket_payload(routes: KirletRouteTable): KirletRouteTable {
  return routes.map((entry) => {
    if (entry.pattern !== "POST /pos-tickets" || entry.raw) return entry;
    const original = entry.handler as (ctx: KirletCtx) => Promise<unknown>;
    return {
      ...entry,
      handler: async (ctx: KirletCtx) => {
        const body = (await ctx.body<Record<string, unknown>>()) ?? {};
        const next = { ...ctx, body: async () => body };
        if (body.payload !== undefined) remember_ticket_payload(next, body.payload);
        try {
          return await original(next);
        } catch (error) {
          if (error instanceof TicketYaExiste) return ctx.json({ data: error.ticket });
          if (error instanceof KirletHttpError && error.status === 409) {
            const existing = await find_ticket_por_clave(ctx.data, body);
            if (existing) return ctx.json({ data: existing });
          }
          throw error;
        }
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
  routes: [
    ...define_routes({
      "POST /pos-tickets/sync-stock": async (ctx) => {
        const summary = await sync_pos_tickets_stock(ctx);
        return ctx.json(summary ?? { applied: 0, skipped: 0, failed: 0 });
      },
      "POST /pos-tickets/:id/sync-stock": async (ctx) => {
        const summary = await sync_pos_tickets_stock(ctx, ctx.params.id);
        if (!summary) return ctx.not_found();
        return ctx.json(summary);
      },
    }),
    ...keep_ticket_payload(define_crud({
    resource: "pos-tickets",
    table: "pos_tickets",
    soft_delete: true,
    soft_delete_field: "is_active",
    history: true,
    default_sort: "name:asc",
    id_prefix: "pos-tick",
    hooks: {
      before_create: pos_tickets_before_create,
      after_create: pos_tickets_after_create,
    },
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
  })),
  ],
  tables: pos_tickets_tables,
  pages: pos_tickets_pages,
  menu: [],
});
