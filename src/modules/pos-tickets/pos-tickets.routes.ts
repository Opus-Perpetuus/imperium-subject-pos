import { define_crud, define_module } from "@opus-perpetuus/imperium-core-kit";
import {
  registrar_cargo_ticket,
  validar_ticket_credito,
} from "../pos-credit/pos-credit.service.ts";
import { pos_tickets_pages } from "./pos-tickets.pages.ts";
import { pos_tickets_tables } from "./pos-tickets.tables.ts";

export const pos_tickets_module = define_module({
  resource: "pos-tickets",
  labels: {
    singular: "Tickets",
    plural: "Tickets",
    read: "Ver Tickets",
    write: "Editar Tickets",
  },
  routes: define_crud({
    resource: "pos-tickets",
    table: "pos_tickets",
    soft_delete: true,
    soft_delete_field: "is_active",
    history: true,
    default_sort: "name:asc",
    id_prefix: "pos-tick",
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
      is_credit: { type: "boolean" },
      credit_amount: { type: "number" },
    },
    options_map: { value: "id", label: "name" },
    hooks: {
      // El límite se rechaza antes de insertar el ticket; el cargo va después.
      before_create: async (ctx, row) => {
        await validar_ticket_credito(ctx.data, row);
        return row;
      },
      after_create: async (ctx, row) => {
        await registrar_cargo_ticket(ctx.data, row);
      },
    },
  }),
  tables: pos_tickets_tables,
  pages: pos_tickets_pages,
  menu: [],
});
