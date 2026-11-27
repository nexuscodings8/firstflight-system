import { Pdf, pdfResponse } from "@/lib/pdf";

// Blank refund / reapplication form to print, fill in by hand and sign. Contains no client data, so it's public.
export async function GET() {
  const p = await Pdf.create("REFUND FORM", "RF-PAPER");
  await p.text("Refund or reapplication request", { size: 14, bold: true, gap: 6 });
  await p.text("Fill in this form in capital letters, sign it, and give it to your FIRST FLIGHT consultant or upload it from your client portal. FIRST FLIGHT reviews every request: your consultant, then Finance, then an administrator. You can follow each step in your client portal.", { color: "muted", size: 9, gap: 10 });
  const field = async (label: string) => { await p.text(label, { size: 9, color: "muted", gap: 0 }); await p.text("_______________________________________________________________________________", { gap: 6 }); };
  for (const f of ["Full name (as on your account)", "Email and phone", "Application reference (e.g. FF-WA-2026-0001)", "Invoice number paid", "Amount paid and payment reference"]) await field(f);
  await p.text("I am asking for:   [  ] a refund of money paid      [  ] reapplication instead of a refund", { gap: 10 });
  await field("Amount asked for (refunds)");
  await p.text("Refund by:   [  ] Mobile money      [  ] Bank transfer", { gap: 8 });
  for (const f of ["Name on the account", "Mobile money number, or bank name and account number", "Reason for the request", "", ""]) await field(f || " ");
  await p.text("I confirm that the information above is correct and that any account given is mine. I understand that refunds follow the terms of my signed service contract and FIRST FLIGHT's refund policy for this service.", { size: 9, gap: 14 });
  await p.signatureBox("Client signature and date");
  await p.text("For office use: received by ____________________   date ____________   request no. RF-________", { size: 8, color: "muted" });
  return pdfResponse(await p.bytes(), "first-flight-refund-form.pdf");
}
