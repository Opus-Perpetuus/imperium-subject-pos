import { KirletHttpError, type DomainRow } from "@opus-perpetuus/imperium-core-kit";

/** Métodos que puede traer cada línea. `mixto` solo sale al derivar el ticket. */
export const PAYMENT_LINE_METHODS = ["efectivo", "tarjeta", "transferencia"] as const;

export type PaymentLineMethod = (typeof PAYMENT_LINE_METHODS)[number];

export type TicketPaymentMethod = PaymentLineMethod | "mixto";

export type PaymentLine = {
  method: PaymentLineMethod;
  amount: number;
  reference?: string;
};

const LINE_METHODS = new Set<string>(PAYMENT_LINE_METHODS);
const AMOUNT_EPS = 1e-9;

function fail(message: string): never {
  throw new KirletHttpError(400, "validation_error", message);
}

function round_money(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function read_amount(value: unknown, label: string): number | undefined {
  if (value == null || value === "") return undefined;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) fail(`${label} no es un monto válido`);
  if (n < 0) fail(`${label} debe ser mayor o igual a 0`);
  return round_money(n);
}

function read_total(row: DomainRow): number | undefined {
  return read_amount(row.total, "el total");
}

/** Acepta arreglo o el JSON en texto que manda el formulario. */
function read_payment_lines(raw: unknown): PaymentLine[] | null {
  if (raw == null || raw === "") return null;
  let value = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      fail("payments no es JSON válido");
    }
  }
  if (!Array.isArray(value)) fail("payments debe ser un arreglo");
  if (value.length === 0) return null;

  return value.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      fail(`pago ${index + 1} inválido`);
    }
    const rec = item as Record<string, unknown>;
    const method = typeof rec.method === "string" ? rec.method.trim() : "";
    if (!LINE_METHODS.has(method)) {
      fail(`método de pago desconocido: ${method || "(vacío)"}`);
    }
    const amount = read_amount(rec.amount, `el monto del pago ${index + 1}`);
    if (amount == null) fail(`falta el monto del pago ${index + 1}`);
    const line: PaymentLine = { method: method as PaymentLineMethod, amount };
    if (typeof rec.reference === "string" && rec.reference.trim()) {
      line.reference = rec.reference.trim();
    }
    return line;
  });
}

function loose_amount_lines(row: DomainRow): PaymentLine[] | null {
  const present = ["cash_amount", "card_amount", "transfer_amount"].some(
    (key) => row[key] != null && row[key] !== "",
  );
  if (!present) return null;

  const cash = read_amount(row.cash_amount, "el efectivo") ?? 0;
  const card = read_amount(row.card_amount, "la tarjeta") ?? 0;
  const transfer = read_amount(row.transfer_amount, "la transferencia") ?? 0;
  const reference =
    typeof row.payment_reference === "string" && row.payment_reference.trim()
      ? row.payment_reference.trim()
      : undefined;

  const lines: PaymentLine[] = [];
  if (cash > 0) lines.push({ method: "efectivo", amount: cash });
  if (card > 0) {
    lines.push(reference && transfer === 0 ? { method: "tarjeta", amount: card, reference } : { method: "tarjeta", amount: card });
  }
  if (transfer > 0) {
    lines.push(reference ? { method: "transferencia", amount: transfer, reference } : { method: "transferencia", amount: transfer });
  }
  return lines;
}

function legacy_cash_lines(row: DomainRow): PaymentLine[] {
  const amount = read_amount(row.total_paid, "total_paid") ?? 0;
  return [{ method: "efectivo", amount }];
}

function sum_by_method(lines: PaymentLine[]): Record<PaymentLineMethod, number> {
  const sums = { efectivo: 0, tarjeta: 0, transferencia: 0 };
  for (const line of lines) sums[line.method] = round_money(sums[line.method] + line.amount);
  return sums;
}

function derive_method(sums: Record<PaymentLineMethod, number>): TicketPaymentMethod {
  const used = PAYMENT_LINE_METHODS.filter((method) => sums[method] > 0);
  if (used.length === 0) return "efectivo";
  if (used.length === 1) return used[0]!;
  return "mixto";
}

function join_references(lines: PaymentLine[], fallback: unknown): string | null {
  const refs: string[] = [];
  for (const line of lines) {
    if (line.reference && !refs.includes(line.reference)) refs.push(line.reference);
  }
  if (refs.length) return refs.join(", ");
  if (typeof fallback === "string" && fallback.trim()) return fallback.trim();
  return null;
}

/**
 * Normaliza la forma de pago de un ticket.
 * `payments` manda si trae líneas; si no, usa los montos sueltos; si no hay nada,
 * queda como efectivo por `total_paid` (tickets viejos).
 * El cambio solo sale del efectivo. Tarjeta y transferencia no pueden pasar el total.
 */
export function normalize_payments(row: DomainRow): DomainRow {
  const from_payments = read_payment_lines(row.payments);
  const lines = from_payments ?? loose_amount_lines(row) ?? legacy_cash_lines(row);
  const sums = sum_by_method(lines);
  const total = read_total(row);
  const non_cash = round_money(sums.tarjeta + sums.transferencia);

  if (total != null && non_cash > total + AMOUNT_EPS) {
    fail("tarjeta y transferencia no pueden exceder el total");
  }
  if (total == null && non_cash > 0) {
    fail("falta el total del ticket");
  }

  const due_cash = total == null ? null : round_money(Math.max(0, total - non_cash));
  let change: number;
  if (due_cash != null) {
    change = round_money(Math.max(0, sums.efectivo - due_cash));
  } else {
    const previous = read_amount(row.change, "el cambio");
    change = previous ?? 0;
  }

  const payment_reference = join_references(lines, from_payments ? null : row.payment_reference);

  return {
    ...row,
    payment_method: derive_method(sums),
    payments: lines,
    cash_amount: sums.efectivo,
    card_amount: sums.tarjeta,
    transfer_amount: sums.transferencia,
    payment_reference,
    total_paid: round_money(sums.efectivo + non_cash),
    change,
  };
}
