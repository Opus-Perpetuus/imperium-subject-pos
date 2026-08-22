import {
  build_feature_shell_page,
  type KirletPageDecl,
} from "@opus-perpetuus/imperium-core-kit";

const API = "api://m/subject-pos";

export const pos_tickets_pages: KirletPageDecl[] = [
  {
    id: "pos.pos-tickets",
    path: "pos-tickets",
    permission: "subject.pos.pos-tickets.read",
    build: () =>
      build_feature_shell_page({
        id: "pos.pos-tickets",
        owner: "subject-pos",
        title: "Tickets",
        props: {
          basePath: "pos-tickets",
          idKey: "id",
          nameKey: "name",
          view: {
            title: "Tickets",
            subtitle: "Submenú de pos",
            pluralLabel: "tickets",
            singularLabel: "tickets",
            emptyTitle: "Sin registros",
            emptyDescription: "Migra desde Mongo o crea el primero",
          },
          data: {
            list: `${API}/pos-tickets`,
            record: `${API}/pos-tickets/:id`,
            create: { method: "POST", action: `${API}/pos-tickets` },
            update: { method: "PATCH", action: `${API}/pos-tickets/:id` },
            delete: { method: "DELETE", action: `${API}/pos-tickets/:id` },
          },
          table: {
            columns: [
              { key: "name", label: "Nombre", sortable: true, priority: 1 },
              { key: "is_active", label: "Activo", sortable: true, priority: 2 },
              { key: "ref", label: "Ref", sortable: true, priority: 3 },
              { key: "ticket_sequence", label: "ticket sequence", sortable: true, priority: 3 },
              { key: "ticket_type", label: "ticket type", sortable: true, priority: 3 },
              { key: "pos_session", label: "pos session", sortable: true, priority: 3 },
              { key: "subtotal", label: "subtotal", sortable: true, priority: 3 },
              { key: "total_paid", label: "total paid", sortable: true, priority: 3 },
              { key: "change", label: "change", sortable: true, priority: 3 },
            ],
            fillHeight: true,
            serverQuery: true,
          },
          form: {
            fields: [
              { name: "name", component: "input-text", label: "Nombre", required: true },
              { name: "description", component: "input-text", label: "Descripción" },
              { name: "ref", component: "input-text", label: "Referencia (_ref)" },
              { name: "ticket_sequence", component: "input-text", label: "ticket sequence" },
              { name: "ticket_type", component: "input-text", label: "ticket type" },
              { name: "pos_session", component: "input-text", label: "pos session" },
              { name: "subtotal", component: "input-number", label: "subtotal" },
              { name: "total_paid", component: "input-number", label: "total paid" },
              { name: "change", component: "input-number", label: "change" },
              { name: "client_id", component: "input-text", label: "client id" },
              { name: "client_name", component: "input-text", label: "client name" },
              { name: "client_lastname", component: "input-text", label: "client lastname" },
              { name: "client_home", component: "input-text", label: "client home" },
              { name: "items", component: "input-text", label: "items" },
              { name: "item_id", component: "input-text", label: "item id" },
              { name: "quantity", component: "input-number", label: "quantity" },
              { name: "total", component: "input-number", label: "total" },
              { name: "unit_price", component: "input-number", label: "unit price" },
              { name: "price_origin", component: "input-text", label: "price origin" },
              { name: "withdrawal_amount", component: "input-number", label: "withdrawal amount" },
              { name: "withdrawal_reason", component: "input-text", label: "withdrawal reason" },
              { name: "withdrawal_signature", component: "input-text", label: "withdrawal signature" },
            ],
          },
        },
      }),
  },
];
