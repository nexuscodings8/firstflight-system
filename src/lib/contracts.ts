import "server-only";
import type { FeePlan } from "./fees";
import { SERVICE_LABEL, date, money } from "./format";
import { Pdf } from "./pdf";
import { conditionOf, conditionText } from "./schedule";

type AppLike = { reference: string; service: string; selection: unknown; feePlan: unknown; client: { name: string; email: string | null; phone: string | null } };

/** Fills a contract template's {{placeholders}} from the application. Unknown placeholders are left visible. */
export function renderContract(body: string, app: AppLike, now = new Date()) {
  const plan = app.feePlan as FeePlan | null;
  const sel = app.selection as { title?: string } | null;
  const values: Record<string, string> = {
    client_name: app.client.name, client_email: app.client.email ?? "-", client_phone: app.client.phone ?? "-",
    reference: app.reference, listing: sel?.title ?? "-", service: SERVICE_LABEL[app.service] ?? app.service,
    fee: plan ? money(plan.amount, plan.currency) ?? "-" : "to be confirmed by FIRST FLIGHT",
    installments: plan ? plan.installments.map((x, i) => `${i + 1}. ${x.label}: ${money(x.amount, plan.currency)}, ${x.dueDate && x.invoiceId ? `due ${date(new Date(x.dueDate))}` : conditionText(conditionOf(x)).toLowerCase()}`).join("\n") : "to be confirmed by FIRST FLIGHT",
    date: date(now) ?? "",
  };
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k: string) => values[k] ?? m);
}

/** The signed-contract PDF: the exact text, then the signature block with its evidence. */
export async function signedContractPdf(o: { title: string; number: string; body: string; signedName: string; signedAt: Date; ip: string | null; version: number | null }) {
  const p = await Pdf.create(o.title.length > 26 ? "AGREEMENT" : o.title.toUpperCase(), o.number);
  await p.text(o.title, { size: 14, bold: true, gap: 8 });
  await p.text(o.body, { gap: 12 });
  p.line();
  await p.text("Signed electronically", { bold: true });
  await p.text(`Signature (typed full name): ${o.signedName}`);
  await p.text(`Signed on: ${o.signedAt.toISOString().replace("T", " ").slice(0, 19)} UTC`);
  await p.text(`IP address: ${o.ip ?? "not recorded"}${o.version ? ` · Template version ${o.version}` : ""}`, { color: "muted", size: 9 });
  return p.bytes();
}

/** Normalises a typed name for comparison: case, accents and extra spaces don't matter. */
export const sameName = (a: string, b: string) => {
  const n = (x: string) => x.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  return n(a) === n(b);
};
