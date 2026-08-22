import {
  build_feature_shell_page,
  type KirletPageDecl,
} from "@opus-perpetuus/imperium-core-kit";

const API = "api://m/subject-pos";

export const pos_pages: KirletPageDecl[] = [
  {
    id: "pos.pos",
    path: "pos",
    permission: "subject.pos.pos.read",
    build: () =>
      build_feature_shell_page({
        id: "pos.pos",
        owner: "subject-pos",
        title: "Estación POS",
        props: {
          basePath: "pos",
          idKey: "id",
          nameKey: "name",
          view: {
            title: "Estación POS",
            subtitle: "Submenú de pos",
            pluralLabel: "estación pos",
            singularLabel: "estación pos",
            emptyTitle: "Sin registros",
            emptyDescription: "Migra desde Mongo o crea el primero",
          },
          data: {
            list: `${API}/pos`,
            record: `${API}/pos/:id`,
            create: { method: "POST", action: `${API}/pos` },
            update: { method: "PATCH", action: `${API}/pos/:id` },
            delete: { method: "DELETE", action: `${API}/pos/:id` },
          },
          table: {
            columns: [
              { key: "name", label: "Nombre", sortable: true, priority: 1 },
              { key: "is_active", label: "Activo", sortable: true, priority: 2 },
              { key: "ref", label: "Ref", sortable: true, priority: 3 },
              { key: "reference", label: "reference", sortable: true, priority: 3 },
              { key: "partner_id", label: "partner id", sortable: true, priority: 3 },
              { key: "partner_name", label: "partner name", sortable: true, priority: 3 },
              { key: "partner_lastname", label: "partner lastname", sortable: true, priority: 3 },
              { key: "partner_home", label: "partner home", sortable: true, priority: 3 },
              { key: "date_order", label: "date order", sortable: true, priority: 3 },
            ],
            fillHeight: true,
            serverQuery: true,
          },
          form: {
            fields: [
              { name: "name", component: "input-text", label: "Nombre", required: true },
              { name: "description", component: "input-text", label: "Descripción" },
              { name: "ref", component: "input-text", label: "Referencia (_ref)" },
              { name: "reference", component: "input-text", label: "reference" },
              { name: "partner_id", component: "input-text", label: "partner id" },
              { name: "partner_name", component: "input-text", label: "partner name" },
              { name: "partner_lastname", component: "input-text", label: "partner lastname" },
              { name: "partner_home", component: "input-text", label: "partner home" },
              { name: "date_order", component: "input-text", label: "date order" },
              { name: "amount_total", component: "input-number", label: "amount total" },
              { name: "lines", component: "input-text", label: "lines" },
              { name: "sync", component: "input-checkbox", label: "sync" },
              { name: "product_id", component: "input-text", label: "product id" },
              { name: "product", component: "input-text", label: "product" },
              { name: "price_unit", component: "input-number", label: "price unit" },
              { name: "quantity", component: "input-number", label: "quantity" },
              { name: "sale_order_id", component: "input-text", label: "sale order id" },
            ],
          },
        },
      }),
  },
];
