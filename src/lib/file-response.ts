import "server-only";
import { readStored } from "./storage";

/** Sends a stored private file. inline=true lets the in-platform viewer show PDFs and images. */
export async function fileResponse(key: string, name: string, mime: string, inline: boolean) {
  let body: Buffer;
  try { body = await readStored(key); } catch (e) {
    // The record exists but the file is gone (e.g. local storage wiped by a redeploy): say so instead of crashing.
    if ((e as { code?: string }).code === "ENOENT" || (e as { name?: string }).name === "NoSuchKey") return new Response("This file is no longer available on the server. Please ask FIRST FLIGHT to upload it again.", { status: 410, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
    throw e;
  }
  const safe = name.replace(/[^\w.\- ]/g, "_");
  const viewable = inline && /^(application\/pdf|image\/(jpeg|png))$/.test(mime);
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": mime,
      "Content-Disposition": `${viewable ? "inline" : "attachment"}; filename="${safe}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
      // Embeddable only by FIRST FLIGHT's own pages, and never able to run scripts.
      // (PDFs are left to the browser's own viewer, which refuses to run in a sandbox.)
      "Content-Security-Policy": mime === "application/pdf" ? "frame-ancestors 'self'" : "sandbox; frame-ancestors 'self'; default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
    },
  });
}
