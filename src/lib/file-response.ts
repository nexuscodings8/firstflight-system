import "server-only";
import { readStored } from "./storage";

/** Sends a stored private file. inline=true lets the in-platform viewer show PDFs and images. */
export async function fileResponse(key: string, name: string, mime: string, inline: boolean) {
  const body = await readStored(key);
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
