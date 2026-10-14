import {
  build_feature_shell_page,
  type KirletPageDecl,
} from "@opus-perpetuus/imperium-core-kit";

const API = "api://m/subject-pos";

export const pos_credit_pages: KirletPageDecl[] = [
  {
    id: "pos.pos-credit",
    path: "pos-credit",
    permission: "subject.pos.pos-credit.read",
    build: () =>
      build_feature_shell_page({
        id: "pos.pos-credit",
        owner: "subject-pos",
        title: "Crédito",
        props: {
          basePath: "pos-credit",
          idKey: "id",
          nameKey: "name",
          view: {
            title: "Crédito",
            subtitle: "Cuentas por cobrar (fiado)",
            pluralLabel: "cuentas de crédito",
            singularLabel: "cuenta de crédito",
            emptyTitle: "Sin cuentas",
            emptyDescription: "Da de alta al cliente con su límite",
          },
          data: {
            list: `${API}/pos-credit-account`,
            record: `${API}/pos-credit-account/:id`,
            create: { method: "POST", action: `${API}/pos-credit-account` },
            update: { method: "PATCH", action: `${API}/pos-credit-account/:id` },
            delete: { method: "DELETE", action: `${API}/pos-credit-account/:id` },
          },
          table: {
            columns: [
              { key: "name", label: "Nombre", sortable: true, priority: 1 },
              { key: "client_name", label: "Cliente", sortable: true, priority: 2 },
              { key: "credit_limit", label: "Límite", sortable: true, priority: 2 },
              { key: "balance", label: "Saldo", sortable: true, priority: 1 },
              { key: "is_active", label: "Activo", sortable: true, priority: 3 },
            ],
            fillHeight: true,
            serverQuery: true,
          },
          form: {
            fields: [
              { name: "name", component: "input-text", label: "Nombre", required: true },
              { name: "description", component: "input-textarea", label: "Descripción" },
              { name: "ref", component: "input-text", label: "Referencia (_ref)" },
              { name: "client_id", component: "input-text", label: "Cliente", required: true },
              { name: "client_name", component: "input-text", label: "Nombre del cliente" },
              { name: "credit_limit", component: "input-money", label: "Límite de crédito" },
              { name: "balance", component: "input-money", label: "Saldo inicial" },
            ],
          },
        },
      }),
  },
];
