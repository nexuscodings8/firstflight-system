import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

// Where uploaded client documents are kept:
//  - S3-compatible object storage (Cloudflare R2, AWS S3, Backblaze B2…) when S3_BUCKET is set: permanent,
//    survives restarts and redeploys, works on any Render plan.
//  - Otherwise a folder on disk (UPLOAD_DIR). On Render this is only permanent with a persistent disk
//    mounted there (paid plans); on the free plan files disappear when the service restarts.
// Files are never public: they are only served through /api/documents/[id] after a permission check.
const ROOT = path.resolve(/*turbopackIgnore: true*/ process.env.UPLOAD_DIR || "./storage/uploads");
export const MAX_BYTES = 10 * 1024 * 1024;
export const ALLOWED: Record<string, string> = {
  "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png",
  "application/msword": "doc", "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

const bucket = () => process.env.S3_BUCKET || "";
export const storageMode = () => (bucket() ? "object" : "disk") as "object" | "disk";

let client: S3Client | null = null;
function s3() {
  client ??= new S3Client({
    region: process.env.S3_REGION || "auto",
    endpoint: process.env.S3_ENDPOINT || undefined, // e.g. https://<account>.r2.cloudflarestorage.com
    forcePathStyle: !!process.env.S3_ENDPOINT,
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID || "", secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "" },
  });
  return client;
}

/** Checks a file's first bytes really match its declared type, so a renamed program can't pass as a PDF. */
export function looksLike(type: string, head: Uint8Array) {
  const starts = (...b: number[]) => b.every((x, i) => head[i] === x);
  switch (type) {
    case "application/pdf": return starts(0x25, 0x50, 0x44, 0x46); // %PDF
    case "image/jpeg": return starts(0xff, 0xd8, 0xff);
    case "image/png": return starts(0x89, 0x50, 0x4e, 0x47);
    case "application/msword": return starts(0xd0, 0xcf, 0x11, 0xe0);
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document": return starts(0x50, 0x4b, 0x03, 0x04); // zip
    default: return false;
  }
}

export async function saveFile(file: File) {
  const ext = ALLOWED[file.type];
  const key = `${new Date().getFullYear()}/${randomBytes(16).toString("hex")}.${ext}`;
  const body = Buffer.from(await file.arrayBuffer());
  if (bucket()) {
    await s3().send(new PutObjectCommand({ Bucket: bucket(), Key: key, Body: body, ContentType: file.type }));
    return key;
  }
  const full = path.join(/*turbopackIgnore: true*/ ROOT, key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, body);
  return key;
}

export async function readStored(key: string): Promise<Buffer> {
  if (!/^\d{4}\/[a-f0-9]{32}\.(pdf|jpg|png|docx?)$/.test(key)) throw new Error("Invalid key");
  if (bucket()) {
    const r = await s3().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
    return Buffer.from(await r.Body!.transformToByteArray());
  }
  const full = path.join(/*turbopackIgnore: true*/ ROOT, key);
  if (!full.startsWith(ROOT + path.sep)) throw new Error("Invalid key");
  return readFile(full);
}

/** Writes and reads back a tiny test object; used by the launch checks. */
export async function storageSelfTest() {
  try {
    if (bucket()) {
      const key = `healthcheck/${randomBytes(6).toString("hex")}.txt`;
      await s3().send(new PutObjectCommand({ Bucket: bucket(), Key: key, Body: "ok" }));
      const r = await s3().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
      return (await r.Body!.transformToString()) === "ok" ? null : "Read-back did not match.";
    }
    const full = path.join(/*turbopackIgnore: true*/ ROOT, ".healthcheck");
    await mkdir(ROOT, { recursive: true });
    await writeFile(full, "ok");
    return (await readFile(full, "utf8")) === "ok" ? null : "Read-back did not match.";
  } catch (e) { return (e as Error).message.slice(0, 200); }
}
