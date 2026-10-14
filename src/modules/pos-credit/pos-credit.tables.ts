import type { KirletTableDecl } from "@opus-perpetuus/imperium-core-kit";

export const pos_credit_tables: KirletTableDecl[] = [
  {
    name: "pos_credit_account",
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
      { name: "client_id", type: "text", notNull: true },
      { name: "client_name", type: "text" },
      { name: "credit_limit", type: "real", notNull: true, default: 0 },
      { name: "balance", type: "real", notNull: true, default: 0 },
    ],
    indexes: [
      { name: "idx_pos_credit_account_name", columns: ["name"] },
      { name: "idx_pos_credit_account_active", columns: ["is_active"] },
      { name: "idx_pos_credit_account_client", columns: ["client_id"], unique: true },
    ],
  },
  {
    name: "pos_credit_movement",
    columns: [
      { name: "id", type: "text", primaryKey: true },
      {
        name: "account_id",
        type: "text",
        notNull: true,
        references: { table: "pos_credit_account", column: "id" },
      },
      { name: "client_id", type: "text", notNull: true },
      { name: "ticket_id", type: "text" },
      { name: "kind", type: "text", notNull: true },
      { name: "amount", type: "real", notNull: true },
      { name: "balance_after", type: "real", notNull: true },
      { name: "note", type: "text" },
      { name: "created_at", type: "text", notNull: true },
    ],
    indexes: [
      { name: "idx_pos_credit_movement_account", columns: ["account_id"] },
      { name: "idx_pos_credit_movement_client", columns: ["client_id"] },
      { name: "idx_pos_credit_movement_ticket", columns: ["ticket_id"] },
    ],
    checks: ["kind IN ('cargo', 'abono')"],
  },
];
