/* Grow (Meshulam) webhook payload helpers — pure functions, used by the server
 * route (to classify + store) and by the app (to apply to projects).
 * Field names follow https://developers.grow.business/docs/webhooks */

export type GrowKind = "so_failed" | "so_charge" | "invoice" | "payment";

type Obj = Record<string, unknown>;

/** Grow's newer formats wrap the fields in `data` — flatten one level */
export function flatten(payload: unknown): Obj {
  const p = (payload && typeof payload === "object" ? payload : {}) as Obj;
  const inner =
    p.data && typeof p.data === "object" && !Array.isArray(p.data) ? (p.data as Obj) : {};
  return { ...p, ...inner };
}

const str = (v: unknown) => (v == null ? "" : String(v).trim());

export function classify(payload: unknown): GrowKind {
  const f = flatten(payload);
  if (f.error_message != null || f.charges_attempts != null || f.regular_payment_id != null)
    return "so_failed";
  if (f.invoiceUrl != null || f.invoiceNumber != null) return "invoice";
  if (f.directDebitId != null || str(f.transactionType).includes("הוראת") || f.periodicalPaymentSum)
    return "so_charge";
  return "payment";
}

export interface GrowFields {
  name: string;
  phone: string;
  email: string;
  sum: number;
  desc: string;
  error: string;
  attempts: number;
  date: string; // yyyy-mm-dd or ""
  txCode: string;
  invoiceUrl: string;
  invoiceNumber: string;
  directDebitId: string;
  cardSuffix: string;
}

/** dd/mm/yy(yy) or yyyy-mm-dd → yyyy-mm-dd */
function toDay(v: string) {
  const iso = v.match(/\d{4}-\d{2}-\d{2}/);
  if (iso) return iso[0];
  const m = v.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return "";
}

export function fields(payload: unknown): GrowFields {
  const f = flatten(payload);
  return {
    name: str(f.payer_name ?? f.fullName),
    phone: str(f.phone ?? f.payerPhone),
    email: str(f.email ?? f.payerEmail).toLowerCase(),
    sum:
      Number(
        str(f.sum ?? f.paymentSum ?? f.periodicalPaymentSum ?? f.amount).replace(/[^\d.]/g, ""),
      ) || 0,
    desc: str(f.description ?? f.paymentDesc ?? f.purchasePageTitle),
    error: str(f.error_message),
    attempts: Number(f.charges_attempts) || 0,
    date: toDay(str(f.paymentDate)),
    txCode: str(f.transactionCode ?? f.transactionId ?? f.asmachta),
    invoiceUrl: str(f.invoiceUrl),
    invoiceNumber: str(f.invoiceNumber),
    directDebitId: str(f.directDebitId ?? f.regular_payment_id),
    cardSuffix: str(f.cardSuffix ?? f.card_suffix),
  };
}

/** 050-123-4567 / +972501234567 → 0501234567 */
export const normPhone = (p: string) => {
  let d = (p || "").replace(/\D/g, "");
  if (d.startsWith("972")) d = "0" + d.slice(3);
  return d;
};

/** parse JSON, x-www-form-urlencoded (incl. "data[key]" arrays) or multipart bodies */
export async function readBody(request: Request): Promise<Obj> {
  const type = request.headers.get("content-type") || "";
  const text = await request.text();
  if (!text) return {};
  if (type.includes("json") || /^\s*[[{]/.test(text)) {
    try {
      return JSON.parse(text);
    } catch {
      /* fall through */
    }
  }
  const out: Obj = {};
  const params = new URLSearchParams(text);
  params.forEach((value, key) => {
    const m = key.match(/^([^[]+)\[([^\]]*)\]$/);
    if (m) {
      const bucket = (out[m[1]] as Obj) ?? {};
      bucket[m[2]] = value;
      out[m[1]] = bucket;
    } else out[key] = value;
  });
  return out;
}
