// Reglas de saldo a crédito (fiado). Sin acceso a datos: las rutas y los
// hooks deciden cuándo leer o escribir.

export type TipoMovimientoCredito = "cargo" | "abono";

export interface MovimientoCredito {
  kind: TipoMovimientoCredito;
  amount: number;
  balance_after: number;
}

export type PlanCredito =
  | { ok: true; balance_after: number; movimiento: MovimientoCredito }
  | { ok: false; mensaje: string };

const CENTAVOS = 100;

/** Pesos a centavos enteros para no arrastrar error binario. */
export function a_centavos(pesos: number): number {
  if (!Number.isFinite(pesos)) return Number.NaN;
  return Math.round(pesos * CENTAVOS);
}

export function a_pesos(centavos: number): number {
  return centavos / CENTAVOS;
}

/**
 * Cargo de una venta a crédito.
 * Sin cliente falla. El límite solo aplica si `credit_limit` es mayor a cero
 * (cero = sin tope, cuenta nueva incluida).
 */
export function validar_venta_credito(input: {
  client_id?: string | null;
  credit_amount: number;
  balance: number;
  credit_limit: number;
}): PlanCredito {
  const client_id = String(input.client_id ?? "").trim();
  if (!client_id) {
    return { ok: false, mensaje: "La venta a crédito requiere un cliente" };
  }
  const monto = a_centavos(input.credit_amount);
  const saldo = a_centavos(input.balance);
  const limite = a_centavos(input.credit_limit);
  if (!Number.isFinite(monto) || monto <= 0) {
    return { ok: false, mensaje: "El monto del crédito debe ser mayor a cero" };
  }
  if (!Number.isFinite(saldo) || saldo < 0) {
    return { ok: false, mensaje: "El saldo de la cuenta no es válido" };
  }
  if (!Number.isFinite(limite) || limite < 0) {
    return { ok: false, mensaje: "El límite de crédito no es válido" };
  }
  const despues = saldo + monto;
  if (limite > 0 && despues > limite) {
    return { ok: false, mensaje: "El cargo excede el límite de crédito" };
  }
  const balance_after = a_pesos(despues);
  return {
    ok: true,
    balance_after,
    movimiento: {
      kind: "cargo",
      amount: a_pesos(monto),
      balance_after,
    },
  };
}

/** Abono: baja el saldo y no lo deja en negativo. */
export function aplicar_abono(balance: number, amount: number): PlanCredito {
  const saldo = a_centavos(balance);
  const monto = a_centavos(amount);
  if (!Number.isFinite(saldo) || saldo < 0) {
    return { ok: false, mensaje: "El saldo de la cuenta no es válido" };
  }
  if (!Number.isFinite(monto) || monto <= 0) {
    return { ok: false, mensaje: "El abono debe ser mayor a cero" };
  }
  if (monto > saldo) {
    return { ok: false, mensaje: "El abono supera el saldo y lo dejaría negativo" };
  }
  const balance_after = a_pesos(saldo - monto);
  return {
    ok: true,
    balance_after,
    movimiento: {
      kind: "abono",
      amount: a_pesos(monto),
      balance_after,
    },
  };
}
