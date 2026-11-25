import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// Local-disk storage for development and single-server hosting (use a persistent disk).
// Swap these two functions for S3-compatible storage without touching callers.
const ROOT = path.resolve(/*turbopackIgnore: true*/ process.env.UPLOAD_DIR || "./storage/uploads");
export const MAX_BYTES = 10 * 1024 * 1024;
export const ALLOWED: Record<string, string> = {
  "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png",
  "application/msword": "doc", "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

export async function saveFile(file: File) {
  const ext = ALLOWED[file.type];
  const key = `${new Date().getFullYear()}/${randomBytes(16).toString("hex")}.${ext}`;
  const full = path.join(/*turbopackIgnore: true*/ ROOT, key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, Buffer.from(await file.arrayBuffer()));
  return key;
}

export async function readStored(key: string) {
  const full = path.join(/*turbopackIgnore: true*/ ROOT, key);
  if (!full.startsWith(ROOT + path.sep)) throw new Error("Invalid key");
  return readFile(full);
}
