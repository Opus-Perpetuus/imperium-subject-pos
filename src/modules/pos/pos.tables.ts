import type { KirletTableDecl } from "@opus-perpetuus/imperium-core-kit";

export const pos_tables: KirletTableDecl[] = [
  {
    name: "pos",
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
      { name: "reference", type: "text" },
      { name: "partner_id", type: "text" },
      { name: "partner_name", type: "text" },
      { name: "partner_lastname", type: "text" },
      { name: "partner_home", type: "text" },
      { name: "date_order", type: "text" },
      { name: "amount_total", type: "real" },
      { name: "lines", type: "text" },
      { name: "sync", type: "boolean" },
      { name: "product_id", type: "text" },
      { name: "product", type: "text" },
      { name: "price_unit", type: "real" },
      { name: "quantity", type: "real" },
      { name: "sale_order_id", type: "text" },
    ],
    indexes: [
      { name: "idx_pos_name", columns: ["name"] },
      { name: "idx_pos_active", columns: ["is_active"] },
    ],
  },
];
