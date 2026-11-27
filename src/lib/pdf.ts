import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { COMPANY } from "./company";

// Simple A4 document builder for invoices, receipts, contracts and the refund form. Uses the built-in
// Helvetica fonts, so text is limited to Latin characters (others are replaced).
const BRAND = rgb(0.016, 0.259, 0.624), INK = rgb(0.06, 0.14, 0.31), MUTED = rgb(0.3, 0.36, 0.49), GOLD = rgb(0.97, 0.75, 0.16);
const W = 595.28, H = 841.89, M = 50;
const clean = (t: string | null | undefined) => (t ?? "-").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/…/g, "...").replace(/→/g, "->").replace(/[^\x20-\x7E\xA0-\xFF\n]/g, "?");

export class Pdf {
  doc!: PDFDocument; page!: PDFPage; font!: PDFFont; bold!: PDFFont; y = 0;
  static async create(title: string, number: string) {
    const p = new Pdf();
    p.doc = await PDFDocument.create();
    p.doc.setTitle(`${title} ${number}`); p.doc.setAuthor(COMPANY.legalName); p.doc.setCreator("FIRST FLIGHT system");
    p.font = await p.doc.embedFont(StandardFonts.Helvetica); p.bold = await p.doc.embedFont(StandardFonts.HelveticaBold);
    await p.newPage(title, number);
    return p;
  }
  private title = ""; private number = "";
  async newPage(title = this.title, number = this.number) {
    this.title = title; this.number = number;
    this.page = this.doc.addPage([W, H]);
    try {
      const png = await this.doc.embedPng(await readFile(path.join(process.cwd(), "public", "logo-mark.png")));
      this.page.drawImage(png, { x: M, y: H - M - 46, width: 46, height: 46 });
    } catch { /* logo optional */ }
    this.page.drawText("FIRST FLIGHT", { x: M + 56, y: H - M - 20, size: 16, font: this.bold, color: BRAND });
    this.page.drawText(clean(COMPANY.legalName), { x: M + 56, y: H - M - 34, size: 8, font: this.font, color: MUTED });
    this.page.drawText(clean(`${COMPANY.email} · ${COMPANY.phones.join(" · ")}`), { x: M + 56, y: H - M - 45, size: 8, font: this.font, color: MUTED });
    const tw = this.bold.widthOfTextAtSize(title, 20);
    this.page.drawText(title, { x: W - M - tw, y: H - M - 20, size: 20, font: this.bold, color: BRAND });
    const nw = this.bold.widthOfTextAtSize(number, 10);
    this.page.drawText(number, { x: W - M - nw, y: H - M - 36, size: 10, font: this.bold, color: INK });
    this.page.drawRectangle({ x: M, y: H - M - 60, width: W - 2 * M, height: 3, color: GOLD });
    this.y = H - M - 84;
  }
  private need(h: number) { if (this.y - h < M + 30) return this.newPage(); }
  async text(t: string | null, o: { size?: number; bold?: boolean; color?: "muted" | "brand"; gap?: number; indent?: number } = {}) {
    const size = o.size ?? 10, f = o.bold ? this.bold : this.font, x = M + (o.indent ?? 0), max = W - M - x;
    for (const para of clean(t).split("\n")) {
      const words = para.split(" "); let line = "";
      const flush = async () => { await this.need(size + 4); this.page.drawText(line, { x, y: this.y, size, font: f, color: o.color === "muted" ? MUTED : o.color === "brand" ? BRAND : INK }); this.y -= size + 4; line = ""; };
      for (const w of words) { const next = line ? `${line} ${w}` : w; if (f.widthOfTextAtSize(next, size) > max && line) { await flush(); line = w; } else line = next; }
      if (line || !para) await flush();
    }
    this.y -= o.gap ?? 4;
  }
  /** Two columns of label/value pairs. */
  async pairs(rows: [string, string | null][]) {
    for (let i = 0; i < rows.length; i += 2) {
      await this.need(28);
      for (const [j, [k, v]] of rows.slice(i, i + 2).entries()) {
        const x = M + j * ((W - 2 * M) / 2);
        this.page.drawText(clean(k), { x, y: this.y, size: 8, font: this.font, color: MUTED });
        this.page.drawText(clean(v).slice(0, 60), { x, y: this.y - 12, size: 10, font: this.bold, color: INK });
      }
      this.y -= 30;
    }
  }
  /** A simple table; the last column is right-aligned. */
  async table(head: string[], rows: (string | null)[][], widths: number[]) {
    const total = W - 2 * M, xs = widths.reduce<number[]>((a, w, i) => [...a, (a[i - 1] ?? M) + (i ? widths[i - 1] * total : 0)], []).map((x, i) => (i === 0 ? M : x));
    const draw = async (cells: (string | null)[], bold: boolean) => {
      await this.need(18);
      cells.forEach((c, i) => {
        const t = clean(c), f = bold ? this.bold : this.font;
        let fit = t; while (f.widthOfTextAtSize(fit, 9) > widths[i] * total - 6 && fit.length > 3) fit = fit.slice(0, -2);
        const x = i === cells.length - 1 ? M + total - f.widthOfTextAtSize(fit, 9) : xs[i];
        this.page.drawText(fit, { x, y: this.y, size: 9, font: f, color: bold ? MUTED : INK });
      });
      this.y -= 6; this.page.drawLine({ start: { x: M, y: this.y }, end: { x: M + total, y: this.y }, thickness: 0.5, color: rgb(0.85, 0.88, 0.93) }); this.y -= 12;
    };
    await draw(head, true);
    for (const r of rows) await draw(r, false);
    this.y -= 6;
  }
  line() { this.page.drawLine({ start: { x: M, y: this.y + 6 }, end: { x: W - M, y: this.y + 6 }, thickness: 0.5, color: MUTED }); this.y -= 8; }
  async signatureBox(label: string) { await this.need(60); this.page.drawLine({ start: { x: M, y: this.y - 30 }, end: { x: M + 220, y: this.y - 30 }, thickness: 0.8, color: INK }); this.page.drawText(label, { x: M, y: this.y - 44, size: 8, font: this.font, color: MUTED }); this.y -= 60; }
  async bytes() { return this.doc.save(); }
}

export const pdfResponse = (bytes: Uint8Array, name: string, inline = false) => new Response(new Uint8Array(bytes), {
  headers: { "Content-Type": "application/pdf", "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${name}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
});
