import { readFileSync, existsSync, unlinkSync } from "node:fs";
import path from "node:path";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const STORAGE_BUCKET = process.env.STORAGE_BUCKET || "video-renders";

export function isStorageConfigured(): boolean {
  return !!(SUPABASE_URL && SUPABASE_SERVICE_KEY);
}

// Upload a local file to Supabase Storage and return its public URL
export async function uploadToStorage(localPath: string, fileName: string): Promise<string> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error("Supabase storage not configured (SUPABASE_URL / SUPABASE_SERVICE_KEY missing)");
  }

  if (!existsSync(localPath)) throw new Error(`File not found: ${localPath}`);

  const fileBuffer = readFileSync(localPath);
  const ext = path.extname(fileName).toLowerCase();
  const contentType = ext === ".mp4" ? "video/mp4" : ext === ".mp3" ? "audio/mpeg" : "application/octet-stream";

  // Upload via Supabase Storage REST API
  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${fileName}`;

  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      "Content-Type": contentType,
      "x-upsert": "true",
    },
    body: fileBuffer,
  });

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`Supabase upload failed (${res.status}): ${err}`);
  }

  // Return public URL
  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${fileName}`;
  console.info(`[STORAGE] Uploaded → ${publicUrl}`);
  return publicUrl;
}

// Upload and optionally delete local file after
export async function uploadAndClean(localPath: string, fileName: string, deleteLocal = false): Promise<string> {
  const url = await uploadToStorage(localPath, fileName);
  if (deleteLocal) {
    try { unlinkSync(localPath); } catch {}
  }
  return url;
}
