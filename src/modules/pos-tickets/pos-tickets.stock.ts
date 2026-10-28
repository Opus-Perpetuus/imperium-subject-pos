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

/** Reponer `payload` si el CRUD lo descartó antes de los hooks. */
export function with_pending_payload(ctx: object, row: DomainRow): DomainRow {
  if ((row.payload == null || row.payload === "") && pending_payload.has(ctx)) {
    return { ...row, payload: pending_payload.get(ctx) };
  }
  return row;
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

/**
 * Clave del reenvío offline: `ref` si viene; si no, sesión + consecutivo.
 * Sin ninguna de las dos no hay forma de reconocer el mismo ticket.
 */
export function ticket_idempotency_key(row: Record<string, unknown>): string | null {
  const ref = text(row.ref);
  if (ref) return `ref:${ref}`;
  const session = text(row.pos_session);
  const seq = text(row.ticket_sequence);
  if (session && seq) return `seq:${session}:${seq}`;
  return null;
}

/** Referencia que se guarda en el movimiento de almacén. */
export function ticket_stock_ref(row: Record<string, unknown>): string {
  const ref = text(row.ref);
  if (ref) return ref;
  const session = text(row.pos_session);
  const seq = text(row.ticket_sequence);
  if (session && seq) return `${session}:${seq}`;
  return text(row.id) || "pos-ticket";
}

/** El CRUD no puede abortar el insert: el handler convierte esto en el ticket ya guardado. */
export class TicketYaExiste extends Error {
  readonly ticket: DomainRow;

  constructor(ticket: DomainRow) {
    super("ticket ya existe");
    this.name = "TicketYaExiste";
    this.ticket = ticket;
  }
}

export async function find_ticket_por_clave(
  data: KirletCtx["data"],
  row: Record<string, unknown>,
): Promise<DomainRow | null> {
  const ref = text(row.ref);
  if (ref) return data.findOne("pos_tickets", { ref });
  const session = text(row.pos_session);
  const seq = text(row.ticket_sequence);
  if (session && seq) {
    return data.findOne("pos_tickets", { pos_session: session, ticket_sequence: seq });
  }
  return null;
}

function custom_of(row: Record<string, unknown>): Record<string, unknown> {
  return read_object(row.custom_data) ?? {};
}

export function stock_status_of(row: Record<string, unknown>): string {
  return text(custom_of(row).stock_status);
}

function movement_rows(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.filter(is_record);
  if (!is_record(value)) return [];
  if (Array.isArray(value.data)) return value.data.filter(is_record);
  if (value.documento_referencia || value.producto_id || value.dedupe_key) return [value];
  return [];
}

function movement_matches(
  movement: Record<string, unknown>,
  ref: string,
  product_id: string,
  ticket_id: string,
): boolean {
  const product = text(movement.producto_id) || text(movement.producto);
  const dedupe = text(movement.dedupe_key);
  if (dedupe === `pos-ticket:${ref}:${product_id}`) return true;
  if (ticket_id && dedupe === `pos-ticket:${ticket_id}:${product_id}`) return true;
  return text(movement.documento_referencia) === ref && product === product_id;
}

/** Ya hay salida de este ticket y producto: no se vuelve a tocar quant ni existencia. */
async function movement_exists(
  call: AlmacenCall,
  row: Record<string, unknown>,
  line: SoldLine,
): Promise<boolean> {
  const ref = ticket_stock_ref(row);
  const listed = await call(ALMACEN_SUBJECT, "GET /inventory-movement", {
    query: {
      q: ref,
      documento_referencia: ref,
      producto_id: line.product_id,
      limite: "50",
    },
  });
  return movement_rows(listed).some((movement) => {
    return movement_matches(movement, ref, line.product_id, text(row.id));
  });
}

async function post_movement(
  call: AlmacenCall,
  row: Record<string, unknown>,
  line: SoldLine,
): Promise<void> {
  const ref = ticket_stock_ref(row);
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
      dedupe_key: `pos-ticket:${ref}:${line.product_id}`,
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

/**
 * Descuenta en almacén. Nunca exige existencia suficiente: quant y existencia pueden quedar en negativo.
 * Devuelve el error, o `null` si no había nada que hacer o salió bien.
 * Si el movimiento de ese ticket y producto ya existe, no registra otra salida ni vuelve a ajustar.
 */
export async function deduct_ticket_stock(
  row: Record<string, unknown>,
  call: AlmacenCall,
): Promise<string | null> {
  const lines = extract_sold_lines(row);
  if (lines.length === 0) return null;
  const errors: string[] = [];
  for (const line of lines) {
    try {
      if (await movement_exists(call, row, line)) continue;
      // El movimiento queda como marca: un reintento que ya lo vea no vuelve a descontar.
      await post_movement(call, row, line);
      await patch_quants(call, line);
      await patch_product(call, line);
    } catch (error) {
      errors.push(`${line.product_id}: ${error_message(error)}`);
    }
  }
  return errors.length ? errors.join("; ") : null;
}

/** Fallo de datos locales, no de red: el reintento igual lo vuelve a intentar. */
function failure_status(message: string): "pending" | "error" {
  if (/no encontrado|sin id/i.test(message)) return "error";
  return "pending";
}

async function save_stock_status(
  ctx: KirletCtx,
  row: DomainRow,
  status: "pending" | "applied" | "error",
  error_msg: string | null,
): Promise<void> {
  const id = text(row.id);
  if (!id) return;
  const custom_data: Record<string, unknown> = { ...custom_of(row), stock_status: status };
  if (status === "applied") {
    custom_data.stock_applied_at = now_iso();
    delete custom_data.stock_error;
  } else if (error_msg) {
    custom_data.stock_error = error_msg;
    delete custom_data.stock_applied_at;
  }
  const updated_at = now_iso();
  try {
    await ctx.data.update("pos_tickets", { id }, { custom_data, updated_at });
    row.custom_data = custom_data;
    row.updated_at = updated_at;
  } catch (error) {
    console.error(
      `[pos-tickets] no se pudo guardar stock_status en ${id}: ${error_message(error)}`,
    );
  }
}

/** Aplica el descuento y deja `stock_status` en el ticket. La venta no se revierte. */
export async function apply_ticket_stock(
  ctx: KirletCtx,
  row: DomainRow,
): Promise<"applied" | "pending" | "error"> {
  try {
    const error = await deduct_ticket_stock(row, almacen_call);
    if (error) {
      const status = failure_status(error);
      console.error(`[pos-tickets] almacén no descontó el ticket ${text(row.id) || "?"}: ${error}`);
      await save_stock_status(ctx, row, status, error);
      return status;
    }
    await save_stock_status(ctx, row, "applied", null);
    return "applied";
  } catch (error) {
    const message = error_message(error);
    console.error(`[pos-tickets] almacén no descontó el ticket ${text(row.id) || "?"}: ${message}`);
    await save_stock_status(ctx, row, "pending", message);
    return "pending";
  }
}

export type StockSyncSummary = { applied: number; skipped: number; failed: number };

async function list_tickets(ctx: KirletCtx): Promise<DomainRow[]> {
  const page = 200;
  const all: DomainRow[] = [];
  for (let offset = 0; offset < 5000; offset += page) {
    const rows = await ctx.data.findMany("pos_tickets", { limit: page, offset });
    all.push(...rows);
    if (rows.length < page) break;
  }
  return all;
}

/**
 * Reintenta pending/error. Un ticket ya `applied` cuenta como skipped y no vuelve a descontar.
 * Sin id recorre la tabla; con id solo ese ticket (404 si no está → null).
 */
export async function sync_pos_tickets_stock(
  ctx: KirletCtx,
  id?: string,
): Promise<StockSyncSummary | null> {
  let rows: DomainRow[];
  if (id) {
    const row = await ctx.data.findOne("pos_tickets", { id });
    if (!row) return null;
    rows = [row];
  } else {
    rows = (await list_tickets(ctx)).filter((row) => {
      const status = stock_status_of(row);
      return status === "pending" || status === "error" || status === "applied";
    });
  }
  const summary: StockSyncSummary = { applied: 0, skipped: 0, failed: 0 };
  for (const row of rows) {
    if (stock_status_of(row) === "applied") {
      summary.skipped += 1;
      continue;
    }
    const outcome = await apply_ticket_stock(ctx, row);
    if (outcome === "applied") summary.applied += 1;
    else summary.failed += 1;
  }
  return summary;
}

/**
 * Repone `payload` y marca el descuento como pendiente.
 * Si la clave ya existe, no deja crear otro ticket ni descontar de nuevo.
 */
export async function pos_tickets_before_create(
  ctx: KirletCtx,
  row: DomainRow,
): Promise<DomainRow> {
  let next = row;
  if ((row.payload == null || row.payload === "") && pending_payload.has(ctx)) {
    next = { ...row, payload: pending_payload.get(ctx) };
  }
  if (ticket_idempotency_key(next)) {
    const existing = await find_ticket_por_clave(ctx.data, next);
    if (existing) throw new TicketYaExiste(existing);
  }
  const custom_data = { ...custom_of(next), stock_status: "pending" };
  delete custom_data.stock_applied_at;
  delete custom_data.stock_error;
  return { ...next, custom_data };
}

/** Hook `after_create`: un fallo de almacén no revierte la venta. */
export async function pos_tickets_after_create(ctx: KirletCtx, row: DomainRow): Promise<void> {
  await apply_ticket_stock(ctx, row);
}
