import { define_crud, define_module, type DomainRow } from "@opus-perpetuus/imperium-core-kit";
import { normalize_payments } from "./pos-tickets.payments.ts";
import { pos_tickets_pages } from "./pos-tickets.pages.ts";
import { pos_tickets_tables } from "./pos-tickets.tables.ts";

const AMOUNT_KEYS = ["cash_amount", "card_amount", "transfer_amount"] as const;

/** Si el parche solo toca montos, no reutiliza el arreglo `payments` anterior. */
function con_pagos(base: DomainRow, patch?: DomainRow): DomainRow {
  const merged: DomainRow = patch ? { ...base, ...patch } : { ...base };
  if (patch && !("payments" in patch) && AMOUNT_KEYS.some((key) => key in patch)) {
    delete merged.payments;
  }
  return normalize_payments(merged);
}

function campos_pago(normalized: DomainRow, patch: DomainRow): DomainRow {
  return {
    ...patch,
    payment_method: normalized.payment_method,
    payments: normalized.payments,
    cash_amount: normalized.cash_amount,
    card_amount: normalized.card_amount,
    transfer_amount: normalized.transfer_amount,
    payment_reference: normalized.payment_reference,
    total_paid: normalized.total_paid,
    change: normalized.change,
  };
}

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
      payment_method: { type: "string", search: true },
      payments: { type: "json" },
      cash_amount: { type: "number" },
      card_amount: { type: "number" },
      transfer_amount: { type: "number" },
      payment_reference: { type: "string", search: true },
    },
    options_map: { value: "id", label: "name" },
    hooks: {
      before_create: (_ctx, row) => con_pagos(row),
      before_update: (_ctx, _id, patch, existing) => campos_pago(con_pagos(existing, patch), patch),
    },
  }),
  tables: pos_tickets_tables,
  pages: pos_tickets_pages,
  menu: [],
});
