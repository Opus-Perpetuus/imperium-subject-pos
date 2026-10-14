import {
  call_subject,
  now_iso,
  type DomainRow,
  type KirletCtx,
} from "@opus-perpetuus/imperium-core-kit";

/** App de inventario. El movimiento no sincroniza quant ni products.existencia. */
export const ALMACEN_SUBJECT = "subject-almacen";

export type SoldLine = {
  product_id: string;
  quantity: number;
};

/** Misma forma que `call_subject`, sustituible en pruebas. */
export type AlmacenCall = (
  target: string,
  route: string,
  opts?: { body?: unknown; query?: Record<string, string> },
) => Promise<unknown>;

let almacen_call: AlmacenCall = call_subject;

/**
 * `define_crud` no persiste el campo `payload` tal cual llega.
 * El POST lo guarda aquí para reponerlo en `before_create`.
 */
const pending_payload = new WeakMap<object, unknown>();

export function remember_ticket_payload(ctx: object, payload: unknown): void {
  pending_payload.set(ctx, payload);
}

/** `null` vuelve a usar `call_subject`. */
export function set_almacen_call(fn: AlmacenCall | null): void {
  almacen_call = fn ?? call_subject;
}

function is_record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function finite_number(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function num0(value: unknown): number {
  return finite_number(value) ?? 0;
}

function error_message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Retiro de caja: no mueve inventario. */
function is_withdrawal(ticket_type: unknown): boolean {
  const kind = text(ticket_type).toLowerCase();
  return kind === "retiro" || kind === "withdrawal" || kind.includes("retiro") || kind.includes("withdrawal");
}

function read_object(value: unknown): Record<string, unknown> | null {
  if (typeof value === "string") {
    try {
      return read_object(JSON.parse(value));
    } catch {
      return null;
    }
  }
  return is_record(value) ? value : null;
}

/** `null` si el valor no es un arreglo (para caer al otro origen). */
function read_line_array(value: unknown): Record<string, unknown>[] | null {
  let raw = value;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed.startsWith("[")) return null;
    try {
      raw = JSON.parse(trimmed);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(raw)) return null;
  return raw.filter(is_record);
}

function line_records(row: Record<string, unknown>): Record<string, unknown>[] {
  const payload = read_object(row.payload);
  if (payload) {
    const items = read_line_array(payload.items);
    if (items) return items;
    const lines = read_line_array(payload.lines);
    if (lines) return lines;
  }
  if (text(row.item_id) || finite_number(row.quantity) != null) {
    return [{ item_id: row.item_id, product_id: row.product_id, quantity: row.quantity }];
  }
  return [];
}

/**
 * Renglones vendidos, agrupados por producto.
 * Ignora retiros y cantidades que no son una salida real.
 */
export function extract_sold_lines(row: Record<string, unknown>): SoldLine[] {
  if (is_withdrawal(row.ticket_type)) return [];
  const totals = new Map<string, number>();
  for (const line of line_records(row)) {
    const product_id = text(line.item_id) || text(line.product_id);
    const quantity = finite_number(line.quantity);
    if (!product_id || quantity == null || quantity <= 0) continue;
    totals.set(product_id, (totals.get(product_id) ?? 0) + quantity);
  }
  return [...totals.entries()].map(([product_id, quantity]) => ({ product_id, quantity }));
}

function as_rows(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.filter(is_record);
  if (is_record(value) && Array.isArray(value.data)) return value.data.filter(is_record);
  return [];
}

function as_row(value: unknown): Record<string, unknown> | null {
  if (is_record(value) && is_record(value.data) && !("total_elementos" in value)) {
    return value.data;
  }
  return is_record(value) ? value : null;
}

function ticket_ref(row: Record<string, unknown>): string {
  return text(row.ref) || text(row.ticket_sequence) || text(row.id) || "pos-ticket";
}

async function post_movement(
  call: AlmacenCall,
  row: Record<string, unknown>,
  line: SoldLine,
): Promise<void> {
  const ref = ticket_ref(row);
  await call(ALMACEN_SUBJECT, "POST /inventory-movement", {
    body: {
      name: `Salida POS ${ref} ${line.product_id}`,
      tipo_movimiento: "salida",
      producto_id: line.product_id,
      producto: line.product_id,
      cantidad: line.quantity,
      documento_tipo: "pos-ticket",
      documento_modelo: "pos_tickets",
      documento_id: text(row.id),
      documento_nombre: text(row.name) || ref,
      documento_referencia: ref,
      dedupe_key: `pos-ticket:${text(row.id)}:${line.product_id}`,
      fecha_movimiento: now_iso(),
    },
  });
}

async function patch_quants(call: AlmacenCall, line: SoldLine): Promise<void> {
  const listed = await call(ALMACEN_SUBJECT, "GET /inventory-stock-quant", {
    query: { q: line.product_id, limite: "1000" },
  });
  const matches = as_rows(listed).filter((quant) => {
    return text(quant.producto_id) === line.product_id || text(quant.producto) === line.product_id;
  });
  if (matches.length === 0) {
    // Sin fila previa el PATCH no tiene destino; la existencia queda en negativo.
    await call(ALMACEN_SUBJECT, "POST /inventory-stock-quant", {
      body: {
        name: `POS ${line.product_id}`,
        producto_id: line.product_id,
        producto: line.product_id,
        cantidad: -line.quantity,
        cantidad_apartada: 0,
        cantidad_disponible: -line.quantity,
      },
    });
    return;
  }
  let remaining = line.quantity;
  for (let i = 0; i < matches.length && remaining > 0; i++) {
    const quant = matches[i]!;
    const id = text(quant.id);
    if (!id) throw new Error(`quant sin id para ${line.product_id}`);
    const current = num0(quant.cantidad);
    const apartada = num0(quant.cantidad_apartada);
    const is_last = i === matches.length - 1;
    const delta = is_last ? remaining : Math.min(remaining, Math.max(current, 0));
    if (delta <= 0) continue;
    const next = current - delta;
    await call(ALMACEN_SUBJECT, `PATCH /inventory-stock-quant/${encodeURIComponent(id)}`, {
      body: {
        cantidad: next,
        cantidad_disponible: next - apartada,
      },
    });
    remaining -= delta;
  }
}

async function patch_product(call: AlmacenCall, line: SoldLine): Promise<void> {
  const loaded = await call(
    ALMACEN_SUBJECT,
    `GET /products/${encodeURIComponent(line.product_id)}`,
  );
  const product = as_row(loaded);
  if (!product) throw new Error(`producto no encontrado: ${line.product_id}`);
  const existencia = num0(product.existencia) - line.quantity;
  const disponible = existencia - num0(product.existenciaApartada);
  await call(ALMACEN_SUBJECT, `PATCH /products/${encodeURIComponent(line.product_id)}`, {
    body: {
      existencia,
      existenciaDisponible: String(disponible),
    },
  });
}

/** Descuenta en almacén. Devuelve el error, o `null` si no había nada que hacer o salió bien. */
export async function deduct_ticket_stock(
  row: Record<string, unknown>,
  call: AlmacenCall,
): Promise<string | null> {
  const lines = extract_sold_lines(row);
  if (lines.length === 0) return null;
  const errors: string[] = [];
  for (const line of lines) {
    try {
      await post_movement(call, row, line);
      await patch_quants(call, line);
      await patch_product(call, line);
    } catch (error) {
      errors.push(`${line.product_id}: ${error_message(error)}`);
    }
  }
  return errors.length ? errors.join("; ") : null;
}

async function mark_stock_error(ctx: KirletCtx, row: DomainRow, message: string): Promise<void> {
  const id = text(row.id);
  console.error(`[pos-tickets] almacén no descontó el ticket ${id || "?"}: ${message}`);
  if (!id) return;
  const previous = is_record(row.custom_data) ? row.custom_data : {};
  try {
    await ctx.data.update("pos_tickets", { id }, {
      state: "stock_error",
      custom_data: { ...previous, stock_error: message },
      updated_at: now_iso(),
    });
  } catch (error) {
    console.error(
      `[pos-tickets] no se pudo guardar stock_error en ${id}: ${error_message(error)}`,
    );
  }
}

/** Repone `payload` en la fila que el CRUD iba a guardar sin él. */
export function pos_tickets_before_create(ctx: KirletCtx, row: DomainRow): DomainRow {
  if (row.payload != null && row.payload !== "") return row;
  if (!pending_payload.has(ctx)) return row;
  return { ...row, payload: pending_payload.get(ctx) };
}

/** Hook `after_create`: un fallo de almacén no revierte la venta. */
export async function pos_tickets_after_create(ctx: KirletCtx, row: DomainRow): Promise<void> {
  try {
    const error = await deduct_ticket_stock(row, almacen_call);
    if (error) await mark_stock_error(ctx, row, error);
  } catch (error) {
    await mark_stock_error(ctx, row, error_message(error));
  }
}
