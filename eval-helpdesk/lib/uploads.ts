import "server-only";
import { randomUUID } from "node:crypto";
import { BUCKET, db } from "./supabase";

export type Attachment = { path: string; media_type: "image/png" | "image/jpeg" | "image/webp" };

export const MAX_FILES = 3;
export const MAX_BYTES = 5 * 1024 * 1024;

/** Detect the real file type from its first bytes; the browser's claimed type is not trusted. */
function sniff(buf: Buffer): Attachment["media_type"] | null {
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length > 12 && buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") return "image/webp";
  return null;
}

export async function saveScreenshots(reportId: string, files: File[]): Promise<Attachment[]> {
  if (files.length > MAX_FILES) throw new UploadError(`Attach at most ${MAX_FILES} screenshots at a time.`);
  const saved: Attachment[] = [];
  for (const file of files) {
    if (file.size === 0) continue;
    if (file.size > MAX_BYTES) throw new UploadError(`"${file.name}" is larger than 5 MB.`);
    const buf = Buffer.from(await file.arrayBuffer());
    const type = sniff(buf);
    if (!type) throw new UploadError(`"${file.name}" is not a PNG, JPEG or WebP image.`);
    const path = `${reportId}/${randomUUID()}.${type.split("/")[1]}`;
    const { error } = await db().storage.from(BUCKET).upload(path, buf, { contentType: type, upsert: false });
    if (error) throw error;
    saved.push({ path, media_type: type });
  }
  return saved;
}

export async function loadImage(path: string): Promise<string | null> {
  const { data } = await db().storage.from(BUCKET).download(path);
  if (!data) return null;
  return Buffer.from(await data.arrayBuffer()).toString("base64");
}

export class UploadError extends Error {}
