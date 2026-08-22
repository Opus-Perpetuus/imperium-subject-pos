import type { KirletTableDecl } from "@opus-perpetuus/imperium-core-kit";

export const pos_session_tables: KirletTableDecl[] = [
  {
    name: "pos_session",
    columns: [
      { name: "id", type: "text", primaryKey: true },
      { name: "name", type: "text", notNull: true },
      { name: "description", type: "text" },
      { name: "is_active", type: "boolean", notNull: true, default: true },
      { name: "state", type: "text" },
      { name: "ref", type: "text", unique: true },
      { name: "search_field", type: "text" },
      { name: "created_by", type: "text" },
      { name: "custom_data", type: "json" },
      { name: "payload", type: "json" },
      { name: "created_at", type: "text", notNull: true },
      { name: "updated_at", type: "text", notNull: true },
      { name: "consecutivo", type: "real" },
      { name: "diferencia_de_ultimo_cierre", type: "real" },
      { name: "razon_de_diferencia_con_ultimo_cierre", type: "text" },
      { name: "opening_date", type: "text" },
      { name: "cashier", type: "text" },
      { name: "branch_office", type: "text" },
      { name: "status", type: "text" },
      { name: "closing_date", type: "text" },
      { name: "cash_register_opening_money", type: "real" },
      { name: "on_use", type: "boolean" },
      { name: "usage_history", type: "json" },
      { name: "runtime_state", type: "json" },
    ],
    indexes: [
      { name: "idx_pos_session_name", columns: ["name"] },
      { name: "idx_pos_session_active", columns: ["is_active"] },
    ],
  },
];
