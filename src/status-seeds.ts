/**
 * Estatus del POS para el pipeline status-option-control del núcleo.
 * Payload de `POST /api/status-option-control/seed-defaults` con
 * `{ entries: STATUS_OPTION_SEEDS }` (acción `seed_defaults`, solo agrega faltantes).
 * Valores = defaults de imperium-core `state-fields.ts` (PosSession/PosTickets/PosOrder),
 * que el núcleo también siembra solo con `builtin`.
 */
export const STATUS_OPTION_SEED_PATH = "/api/status-option-control/seed-defaults";

type Opt = { value: string; label: string; color: string; type: string };
export type StatusOptionSeed = {
  model_id: string;
  module_name?: string;
  status_fields?: string[];
  options: Array<Opt & { field_name: string }>;
};

function seed(model_id: string, module_name: string, field_name: string, options: Opt[]): StatusOptionSeed {
  return { model_id, module_name, status_fields: [field_name], options: options.map((o) => ({ ...o, field_name })) };
}

export const STATUS_OPTION_SEEDS: StatusOptionSeed[] = [
  seed("PosSession", "pos-session", "status", [
    { value: "abierta", label: "Abierta", type: "warning", color: "#ffc107" },
    { value: "cerrada", label: "Cerrada", type: "neutral", color: "#6c757d" },
    { value: "cancelada", label: "Cancelada", type: "danger", color: "#dc3545" },
  ]),
  seed("PosTickets", "pos-tickets", "state", [
    { value: "borrador", label: "Borrador", type: "warning", color: "#f59f00" },
    { value: "confirmado", label: "Confirmado", type: "info", color: "#0d6efd" },
    { value: "facturado", label: "Facturado", type: "success", color: "#198754" },
    { value: "cancelado", label: "Cancelado", type: "danger", color: "#dc3545" },
  ]),
  seed("PosOrder", "pos-order", "state", [
    { value: "BORRADOR", label: "Borrador", type: "warning", color: "#ffc107" },
    { value: "CONFIRMADO", label: "Confirmado", type: "info", color: "#0dcaf0" },
    { value: "HECHO", label: "Hecho", type: "success", color: "#198754" },
    { value: "CANCELADO", label: "Cancelado", type: "danger", color: "#dc3545" },
  ]),
];
