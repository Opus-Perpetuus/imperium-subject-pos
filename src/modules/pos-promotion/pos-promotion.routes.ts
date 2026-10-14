import { define_crud, define_module, define_routes } from "@opus-perpetuus/imperium-core-kit";
import { KirletHttpError } from "@opus-perpetuus/imperium-core-kit";
import { pos_promotion_pages } from "./pos-promotion.pages.ts";
import { apply_promotions, type PromotionRule, type SaleLine } from "./pos-promotion.logic.ts";
import { pos_promotion_tables } from "./pos-promotion.tables.ts";

function as_lines(items: unknown): SaleLine[] {
  if (!Array.isArray(items)) return [];
  return items.map((raw) => {
    const item = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    return {
      product_id: String(item.product_id ?? ""),
      quantity: Number(item.quantity ?? 0),
      unit_price: Number(item.unit_price ?? 0),
    };
  });
}

export const pos_promotion_module = define_module({
  resource: "pos-promotion",
  labels: {
    singular: "Promoción",
    plural: "Promociones",
    read: "Ver Promociones",
    write: "Editar Promociones",
  },
  routes: [
    ...define_routes({
      "POST /pos-promotion/apply": async (ctx) => {
        const body = (await ctx.body<{ items?: unknown }>()) ?? {};
        if (body.items != null && !Array.isArray(body.items)) {
          throw new KirletHttpError(400, "validation_error", "items debe ser una lista");
        }
        const promos = (await ctx.data.findMany("pos_promotion", {})) as PromotionRule[];
        return { data: apply_promotions(as_lines(body.items), promos, new Date()) };
      },
    }),
    ...define_crud({
      resource: "pos-promotion",
      table: "pos_promotion",
      soft_delete: true,
      soft_delete_field: "is_active",
      history: true,
      default_sort: "name:asc",
      id_prefix: "pos-prom",
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
        kind: { type: "string", search: true },
        product_id: { type: "string", search: true },
        buy_qty: { type: "number" },
        pay_qty: { type: "number" },
        min_qty: { type: "number" },
        unit_price: { type: "number" },
        percent: { type: "number" },
        amount: { type: "number" },
        starts_at: { type: "string", search: true },
        ends_at: { type: "string", search: true },
        priority: { type: "number" },
      },
      options_map: { value: "id", label: "name" },
    }),
  ],
  tables: pos_promotion_tables,
  pages: pos_promotion_pages,
  menu: [],
});
