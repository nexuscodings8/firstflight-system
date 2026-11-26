import "server-only";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";

/** Public address of the site, for links in emails. Render sets RENDER_EXTERNAL_URL automatically. */
export const siteUrl = () => (process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || "http://localhost:3000").replace(/\/$/, "");

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/**
 * Sends one email through Resend when RESEND_API_KEY and EMAIL_FROM are set; otherwise records it as SKIPPED.
 * Never throws: a failed email must not undo the work it reports on. Call it after the database change commits.
 */
export async function sendEmail(to: string, subject: string, body: string, link?: string) {
  const key = process.env.RESEND_API_KEY, from = process.env.EMAIL_FROM;
  const url = link ? `${siteUrl()}${link}` : undefined;
  let status: "SENT" | "FAILED" | "SKIPPED" = "SKIPPED", error: string | null = null;
  if (key && from) {
    const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#0f2350;max-width:560px">
      <p style="font-size:18px;font-weight:bold;color:#04429f">${"FIRST FLIGHT"}</p>
      <p>${esc(body).replace(/\n/g, "<br>")}</p>
      ${url ? `<p><a href="${esc(url)}" style="display:inline-block;background:#04429f;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Open in FIRST FLIGHT</a></p>` : ""}
      <p style="font-size:12px;color:#4d5b7c">This is an automatic message from FIRST FLIGHT. Please do not reply to it.</p></div>`;
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [to], subject, html, text: `${body}${url ? `\n\n${url}` : ""}` }),
        signal: AbortSignal.timeout(8000),
      });
      if (r.ok) status = "SENT";
      else { status = "FAILED"; error = `${r.status} ${(await r.text()).slice(0, 300)}`; }
    } catch (e) { status = "FAILED"; error = (e as Error).message.slice(0, 300); }
  }
  try { await db.insert(s.emailLog).values({ toEmail: to, subject, status, error }); } catch { /* logging must not break the request */ }
  return status;
}

/** Email a user by id (skips deactivated accounts). */
export async function emailUser(userId: string | null | undefined, subject: string, body: string, link?: string) {
  if (!userId) return;
  const u = await db.query.users.findFirst({ where: eq(s.users.id, userId), columns: { email: true, active: true } });
  if (u?.active) await sendEmail(u.email, subject, body, link);
}
