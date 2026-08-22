import {
  build_feature_shell_page,
  type KirletPageDecl,
} from "@opus-perpetuus/imperium-core-kit";

const API = "api://m/subject-pos";

export const pos_session_pages: KirletPageDecl[] = [
  {
    id: "pos.pos-session",
    path: "pos-session",
    permission: "subject.pos.pos-session.read",
    build: () =>
      build_feature_shell_page({
        id: "pos.pos-session",
        owner: "subject-pos",
        title: "Sesiones POS",
        props: {
          basePath: "pos-session",
          idKey: "id",
          nameKey: "name",
          view: {
            title: "Sesiones POS",
            subtitle: "Submenú de pos",
            pluralLabel: "sesiones pos",
            singularLabel: "sesiones pos",
            emptyTitle: "Sin registros",
            emptyDescription: "Migra desde Mongo o crea el primero",
          },
          data: {
            list: `${API}/pos-session`,
            record: `${API}/pos-session/:id`,
            create: { method: "POST", action: `${API}/pos-session` },
            update: { method: "PATCH", action: `${API}/pos-session/:id` },
            delete: { method: "DELETE", action: `${API}/pos-session/:id` },
          },
          table: {
            columns: [
              { key: "name", label: "Nombre", sortable: true, priority: 1 },
              { key: "is_active", label: "Activo", sortable: true, priority: 2 },
              { key: "ref", label: "Ref", sortable: true, priority: 3 },
              { key: "status", label: "Estado", sortable: true, priority: 3 },
              { key: "cashier", label: "Cajero", sortable: true, priority: 3 },
              { key: "branch_office", label: "Sucursal", sortable: true, priority: 3 },
              { key: "opening_date", label: "Apertura", sortable: true, priority: 3 },
              { key: "consecutivo", label: "Consecutivo", sortable: true, priority: 3 },
            ],
            fillHeight: true,
            serverQuery: true,
          },
          form: {
            fields: [
              { name: "name", component: "input-text", label: "Nombre", required: true },
              { name: "description", component: "input-text", label: "Descripción" },
              { name: "ref", component: "input-text", label: "Referencia (_ref)" },
              { name: "consecutivo", component: "input-number", label: "Consecutivo" },
              { name: "opening_date", component: "input-text", label: "Fecha de apertura" },
              { name: "cashier", component: "input-text", label: "Cajero" },
              { name: "branch_office", component: "input-text", label: "Sucursal" },
              { name: "status", component: "input-text", label: "Estado" },
              { name: "closing_date", component: "input-text", label: "Fecha de cierre" },
              { name: "cash_register_opening_money", component: "input-number", label: "Fondo inicial" },
              { name: "on_use", component: "input-checkbox", label: "En uso" },
            ],
          },
        },
      }),
  },
];
