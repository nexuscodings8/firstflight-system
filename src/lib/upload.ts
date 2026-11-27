import "server-only";
import { ALLOWED, MAX_BYTES, looksLike, saveFile } from "./storage";

/** Checks and stores an uploaded file (PDF, JPG, PNG or Word, up to 10 MB, real content checked). */
export async function storeUpload(v: FormDataEntryValue | null, opts: { required: boolean; label: string; imagesAndPdfOnly?: boolean }): Promise<{ key: string; name: string; mime: string } | { error: string } | null> {
  const file = v instanceof File && v.size > 0 ? v : null;
  if (!file) return opts.required ? { error: `Attach ${opts.label}.` } : null;
  if (file.size > MAX_BYTES) return { error: `${opts.label[0].toUpperCase() + opts.label.slice(1)} is larger than 10 MB.` };
  const okTypes = opts.imagesAndPdfOnly ? ["application/pdf", "image/jpeg", "image/png"] : Object.keys(ALLOWED);
  if (!okTypes.includes(file.type)) return { error: `${opts.label[0].toUpperCase() + opts.label.slice(1)} must be ${opts.imagesAndPdfOnly ? "a PDF, JPG or PNG" : "a PDF, JPG, PNG or Word document"}.` };
  if (!looksLike(file.type, new Uint8Array(await file.slice(0, 8).arrayBuffer()))) return { error: `${opts.label[0].toUpperCase() + opts.label.slice(1)} doesn't look like a real ${file.type === "application/pdf" ? "PDF" : "file of that type"}.` };
  const key = await saveFile(file);
  return { key, name: file.name.replace(/[^\w.\- ()]/g, "_").slice(0, 120) || "file", mime: file.type };
}
export const isErr = (x: unknown): x is { error: string } => !!x && typeof x === "object" && "error" in x;
