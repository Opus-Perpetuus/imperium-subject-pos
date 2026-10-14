import {
  KirletHttpError,
  new_id,
  now_iso,
  type DomainRow,
  type KirletDataClient,
} from "@opus-perpetuus/imperium-core-kit";
import { aplicar_abono, validar_venta_credito } from "./pos-credit.logic.ts";

export const TABLA_CUENTA = "pos_credit_account";
export const TABLA_MOVIMIENTO = "pos_credit_movement";

function texto(value: unknown): string {
  return String(value ?? "").trim();
}

function numero(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export async function validar_ticket_credito(
  data: KirletDataClient,
  ticket: DomainRow,
): Promise<void> {
  if (ticket.is_credit !== true) return;
  const client_id = texto(ticket.client_id);
  const cuenta = client_id
    ? await data.findOne(TABLA_CUENTA, { client_id })
    : null;
  if (cuenta && cuenta.is_active === false) {
    throw new KirletHttpError(400, "validation_error", "La cuenta de crédito está inactiva");
  }
  const plan = validar_venta_credito({
    client_id,
    credit_amount: numero(ticket.credit_amount, Number.NaN),
    balance: numero(cuenta?.balance, 0),
    credit_limit: numero(cuenta?.credit_limit, 0),
  });
  if (!plan.ok) {
    throw new KirletHttpError(400, "validation_error", plan.mensaje);
  }
}

/** after_create del ticket: abre la cuenta si no existe y anota el cargo. */
export async function registrar_cargo_ticket(
  data: KirletDataClient,
  ticket: DomainRow,
): Promise<void> {
  if (ticket.is_credit !== true) return;
  const client_id = texto(ticket.client_id);
  const monto = numero(ticket.credit_amount, Number.NaN);

  await data.transaction(async (tx) => {
    let cuenta = await tx.findOne(TABLA_CUENTA, { client_id });
    const ahora = now_iso();
    if (!cuenta) {
      const nombre = texto(ticket.client_name) || client_id;
      cuenta = await tx.insert(TABLA_CUENTA, {
        id: new_id("pos-cred"),
        name: nombre,
        client_id,
        client_name: nombre,
        credit_limit: 0,
        balance: 0,
        is_active: true,
        created_at: ahora,
        updated_at: ahora,
      });
    }
    if (cuenta.is_active === false) {
      throw new KirletHttpError(400, "validation_error", "La cuenta de crédito está inactiva");
    }
    const plan = validar_venta_credito({
      client_id,
      credit_amount: monto,
      balance: numero(cuenta.balance, 0),
      credit_limit: numero(cuenta.credit_limit, 0),
    });
    if (!plan.ok) {
      throw new KirletHttpError(400, "validation_error", plan.mensaje);
    }
    await tx.update(TABLA_CUENTA, { id: String(cuenta.id) }, {
      balance: plan.balance_after,
      client_name: texto(ticket.client_name) || cuenta.client_name,
      updated_at: ahora,
    });
    await tx.insert(TABLA_MOVIMIENTO, {
      id: new_id("pos-cmov"),
      account_id: String(cuenta.id),
      client_id,
      ticket_id: texto(ticket.id) || null,
      kind: "cargo",
      amount: plan.movimiento.amount,
      balance_after: plan.balance_after,
      note: `Cargo de ticket ${texto(ticket.ticket_sequence) || texto(ticket.id)}`,
      created_at: ahora,
    });
  });
}

export async function registrar_abono(
  data: KirletDataClient,
  account_id: string,
  amount: number,
  note: string,
): Promise<{ account: DomainRow; movement: DomainRow }> {
  return data.transaction(async (tx) => {
    const cuenta = await tx.findOne(TABLA_CUENTA, { id: account_id });
    if (!cuenta || cuenta.is_active === false) {
      throw new KirletHttpError(404, "not_found", "Cuenta de crédito no encontrada");
    }
    const plan = aplicar_abono(numero(cuenta.balance, 0), amount);
    if (!plan.ok) {
      throw new KirletHttpError(400, "validation_error", plan.mensaje);
    }
    const ahora = now_iso();
    const account = await tx.update(TABLA_CUENTA, { id: account_id }, {
      balance: plan.balance_after,
      updated_at: ahora,
    });
    if (!account) {
      throw new KirletHttpError(404, "not_found", "Cuenta de crédito no encontrada");
    }
    const movement = await tx.insert(TABLA_MOVIMIENTO, {
      id: new_id("pos-cmov"),
      account_id,
      client_id: texto(cuenta.client_id),
      ticket_id: null,
      kind: "abono",
      amount: plan.movimiento.amount,
      balance_after: plan.balance_after,
      note: note || "Abono",
      created_at: ahora,
    });
    return { account, movement };
  });
}

export async function estado_por_cliente(
  data: KirletDataClient,
  client_id: string,
): Promise<{ account: DomainRow; movements: DomainRow[]; balance: number }> {
  const id = texto(client_id);
  const account = id
    ? await data.findOne(TABLA_CUENTA, { client_id: id })
    : null;
  if (!account || account.is_active === false) {
    throw new KirletHttpError(404, "not_found", "Cuenta de crédito no encontrada");
  }
  const movements = await data.findMany(TABLA_MOVIMIENTO, {
    where: { account_id: String(account.id) },
    orderBy: { created_at: "asc" },
  });
  return { account, movements, balance: numero(account.balance, 0) };
}
