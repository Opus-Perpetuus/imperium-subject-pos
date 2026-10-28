import {
  build_feature_shell_page,
  type KirletPageDecl,
} from "@opus-perpetuus/imperium-core-kit";

const API = "api://m/subject-pos";

export const pos_promotion_pages: KirletPageDecl[] = [
  {
    id: "pos.pos-promotion",
    path: "pos-promotion",
    permission: "subject.pos.pos-promotion.read",
    leaf: {
      "kind": "crud",
      "appBase": "pos-promotion",
      "icon": "fa-tags",
      "listHeaders": {
        "es": {
          "name": "Nombre",
          "kind": "Tipo",
          "is_active": "Activa"
        }
      }
    },
    build: () =>
      build_feature_shell_page({
        id: "pos.pos-promotion",
        owner: "subject-pos",
        title: "Promociones",
        props: {
          basePath: "pos-promotion",
          idKey: "id",
          nameKey: "name",
          view: {
            title: "Promociones",
            subtitle: "2x1, mayoreo y descuento por producto",
            pluralLabel: "promociones",
            singularLabel: "promoción",
            emptyTitle: "Sin promociones",
            emptyDescription: "Crea la primera promoción",
          },
          data: {
            list: `${API}/pos-promotion`,
            record: `${API}/pos-promotion/:id`,
            create: { method: "POST", action: `${API}/pos-promotion` },
            update: { method: "PATCH", action: `${API}/pos-promotion/:id` },
            delete: { method: "DELETE", action: `${API}/pos-promotion/:id` },
          },
          table: {
            columns: [
              { key: "name", label: "Nombre", sortable: true, priority: 1 },
              { key: "kind", label: "Tipo", sortable: true, priority: 2 },
              { key: "product_id", label: "Producto", sortable: true, priority: 2 },
              { key: "is_active", label: "Activo", sortable: true, priority: 3 },
              { key: "priority", label: "Prioridad", sortable: true, priority: 3 },
            ],
            fillHeight: true,
            serverQuery: true,
          },
          form: {
            fields: [
              { name: "name", component: "input-text", label: "Nombre", required: true },
              { name: "description", component: "input-textarea", label: "Descripción" },
              { name: "kind", component: "input-text", label: "Tipo (nxm, mayoreo, descuento)" },
              { name: "product_id", component: "input-text", label: "Producto" },
              { name: "buy_qty", component: "input-number", label: "Lleva (NxM)" },
              { name: "pay_qty", component: "input-number", label: "Paga (NxM)" },
              { name: "min_qty", component: "input-number", label: "Cantidad mínima (mayoreo)" },
              { name: "unit_price", component: "input-money", label: "Precio mayoreo" },
              { name: "percent", component: "input-number", label: "Porcentaje" },
              { name: "amount", component: "input-money", label: "Monto por unidad" },
              { name: "starts_at", component: "input-text", label: "Inicia" },
              { name: "ends_at", component: "input-text", label: "Termina" },
              { name: "priority", component: "input-number", label: "Prioridad" },
              { name: "is_active", component: "input-checkbox", label: "Activa" },
            ],
          },
        },
      }),
  },
];
