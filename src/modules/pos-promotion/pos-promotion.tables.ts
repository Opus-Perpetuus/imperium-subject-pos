import type { KirletTableDecl } from "@opus-perpetuus/imperium-core-kit";

export const pos_promotion_tables: KirletTableDecl[] = [
  {
    name: "pos_promotion",
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
      { name: "kind", type: "text" },
      { name: "product_id", type: "text" },
      { name: "buy_qty", type: "real" },
      { name: "pay_qty", type: "real" },
      { name: "min_qty", type: "real" },
      { name: "unit_price", type: "real" },
      { name: "percent", type: "real" },
      { name: "amount", type: "real" },
      { name: "starts_at", type: "text" },
      { name: "ends_at", type: "text" },
      { name: "priority", type: "integer" },
    ],
    indexes: [
      { name: "idx_pos_promotion_name", columns: ["name"] },
      { name: "idx_pos_promotion_active", columns: ["is_active"] },
      { name: "idx_pos_promotion_product", columns: ["product_id"] },
    ],
  },
];
