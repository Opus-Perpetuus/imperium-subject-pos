/** Renglón de venta que entra al cálculo. */
export type SaleLine = {
  product_id: string;
  quantity: number;
  unit_price: number;
};

/** Renglón ya con el descuento elegido (una sola promo por producto). */
export type PricedLine = {
  product_id: string;
  quantity: number;
  unit_price: number;
  discount: number;
  total: number;
  promotion_id: string | null;
};

/** Promo tal como está en pos_promotion. Campos de más se ignoran. */
export type PromotionRule = {
  id?: unknown;
  kind?: unknown;
  product_id?: unknown;
  buy_qty?: unknown;
  pay_qty?: unknown;
  min_qty?: unknown;
  unit_price?: unknown;
  percent?: unknown;
  amount?: unknown;
  starts_at?: unknown;
  ends_at?: unknown;
  is_active?: unknown;
  priority?: unknown;
};

export type PromotionQuote = {
  lines: PricedLine[];
  total: number;
  discount_total: number;
};

function num(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function money(cents: number): number {
  return cents / 100;
}

function to_cents(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100);
}

function active(rule: PromotionRule): boolean {
  const flag = rule.is_active;
  return flag !== false && flag !== 0 && flag !== "0" && flag !== "false";
}

/** Vigente si now cae en [starts_at, ends_at]. Sin fecha, ese lado no limita. */
function in_force(rule: PromotionRule, now_ms: number): boolean {
  if (!active(rule)) return false;
  const start = rule.starts_at ? Date.parse(String(rule.starts_at)) : NaN;
  if (rule.starts_at != null && rule.starts_at !== "" && !Number.isFinite(start)) return false;
  if (Number.isFinite(start) && now_ms < start) return false;
  const end = rule.ends_at ? Date.parse(String(rule.ends_at)) : NaN;
  if (rule.ends_at != null && rule.ends_at !== "" && !Number.isFinite(end)) return false;
  if (Number.isFinite(end) && now_ms > end) return false;
  return true;
}

/** Ahorro en centavos. 0 si la promo no aplica a este renglón. */
function savings_cents(rule: PromotionRule, quantity: number, unit_price: number, gross_cents: number): number {
  const kind = String(rule.kind ?? "").toLowerCase();
  if (kind === "nxm") {
    const buy = num(rule.buy_qty);
    const pay = num(rule.pay_qty);
    if (buy == null || pay == null || buy <= 0 || pay < 0 || pay > buy) return 0;
    const free = Math.floor(quantity / buy) * (buy - pay);
    if (free <= 0) return 0;
    return Math.min(gross_cents, Math.max(0, to_cents(unit_price * free)));
  }
  if (kind === "mayoreo") {
    const min_qty = num(rule.min_qty);
    const wholesale = num(rule.unit_price);
    if (min_qty == null || wholesale == null || quantity < min_qty) return 0;
    return Math.max(0, gross_cents - to_cents(wholesale * quantity));
  }
  if (kind === "descuento") {
    const percent = num(rule.percent);
    const amount = num(rule.amount);
    let discount = 0;
    if (percent != null) discount = Math.round((gross_cents * percent) / 100);
    else if (amount != null) discount = to_cents(amount * quantity);
    if (discount < 0) return 0;
    return Math.min(gross_cents, discount);
  }
  return 0;
}

/**
 * Aplica promociones vigentes. Por producto gana la de mayor ahorro;
 * no se acumulan. El total de un renglón no baja de 0.
 */
export function apply_promotions(
  lines: SaleLine[],
  promotions: PromotionRule[],
  now: Date,
): PromotionQuote {
  const now_ms = now.getTime();
  const priced: PricedLine[] = [];
  let total_cents = 0;
  let discount_cents = 0;

  for (const line of lines) {
    const quantity = num(line.quantity) ?? 0;
    const unit_price = num(line.unit_price) ?? 0;
    const product_id = String(line.product_id ?? "");
    const gross_cents = Math.max(0, to_cents(quantity * unit_price));
    let best_cents = 0;
    let best_priority = Number.NEGATIVE_INFINITY;
    let best_id: string | null = null;

    if (gross_cents > 0 && product_id) {
      for (const rule of promotions) {
        if (String(rule.product_id ?? "") !== product_id) continue;
        if (!in_force(rule, now_ms)) continue;
        const saved = savings_cents(rule, quantity, unit_price, gross_cents);
        if (saved <= 0) continue;
        const priority = num(rule.priority) ?? 0;
        if (saved > best_cents || (saved === best_cents && priority > best_priority)) {
          best_cents = saved;
          best_priority = priority;
          best_id = rule.id == null || rule.id === "" ? null : String(rule.id);
        }
      }
    }

    const discount = money(best_cents);
    const total = money(gross_cents - best_cents);
    total_cents += gross_cents - best_cents;
    discount_cents += best_cents;
    priced.push({
      product_id,
      quantity,
      unit_price,
      discount,
      total,
      promotion_id: best_cents > 0 ? best_id : null,
    });
  }

  return {
    lines: priced,
    total: money(total_cents),
    discount_total: money(discount_cents),
  };
}
