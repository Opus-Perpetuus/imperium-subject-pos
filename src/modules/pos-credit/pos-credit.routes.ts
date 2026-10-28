import {
  define_crud,
  define_module,
  define_routes,
  KirletHttpError,
  type KirletCtx,
} from "@opus-perpetuus/imperium-core-kit";
import { pos_credit_pages } from "./pos-credit.pages.ts";
import { estado_por_cliente, registrar_abono, TABLA_CUENTA } from "./pos-credit.service.ts";
import { pos_credit_tables } from "./pos-credit.tables.ts";

async function abono(ctx: KirletCtx) {
  const body = (await ctx.body<{ amount?: unknown; note?: unknown }>()) ?? {};
  const amount = Number(body.amount);
  const note = typeof body.note === "string" ? body.note.trim() : "";
  const data = await registrar_abono(ctx.data, ctx.params.id, amount, note);
  return { data };
}

async function estado(ctx: KirletCtx) {
  const data = await estado_por_cliente(ctx.data, ctx.params.client_id);
  return { data };
}

export const pos_credit_module = define_module({
  resource: "pos-credit",
  aliases: ["pos-credit-account"],
  labels: {
    singular: "Cuenta de crédito",
    plural: "Cuentas de crédito",
    read: "Ver crédito",
    write: "Editar crédito",
  },
  routes: [
    ...define_routes({
      "POST /pos-credit-account/:id/abono": abono,
      "GET /pos-credit-account/estado/:client_id": estado,
    }),
    ...define_crud({
      resource: "pos-credit-account",
      table: TABLA_CUENTA,
      soft_delete: true,
      soft_delete_field: "is_active",
      history: true,
      default_sort: "name:asc",
      id_prefix: "pos-cred",
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
        client_id: { type: "string", required: true, search: true },
        client_name: { type: "string", search: true },
        credit_limit: { type: "number" },
        // El saldo vivo solo se mueve con cargo o abono.
        balance: { type: "number", update: false },
      },
      options_map: { value: "id", label: "name" },
      hooks: {
        before_create: async (ctx, row) => {
          const client_id = String(row.client_id ?? "").trim();
          if (!client_id) {
            throw new KirletHttpError(400, "validation_error", "Se requiere client_id");
          }
          row.client_id = client_id;
          if (row.credit_limit == null) row.credit_limit = 0;
          if (row.balance == null) row.balance = 0;
          if (Number(row.credit_limit) < 0) {
            throw new KirletHttpError(400, "validation_error", "El límite de crédito no es válido");
          }
          if (Number(row.balance) < 0) {
            throw new KirletHttpError(400, "validation_error", "El saldo inicial no puede ser negativo");
          }
          const previa = await ctx.data.findOne(TABLA_CUENTA, { client_id });
          if (previa) {
            throw new KirletHttpError(409, "conflict", "El cliente ya tiene cuenta de crédito");
          }
          return row;
        },
      },
    }),
  ],
  tables: pos_credit_tables,
  pages: pos_credit_pages,
  menu: [],
});
