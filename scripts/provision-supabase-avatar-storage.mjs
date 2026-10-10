/**
 * Provisions Supabase Storage for profile avatars + Avaturn GLB uploads.
 *
 * Requires in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY  (Dashboard → Project Settings → API → service_role)
 *
 * Run: node scripts/provision-supabase-avatar-storage.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvLocal();

const url =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL;
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!url) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL in .env.local");
  process.exit(1);
}

if (!serviceKey) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY in .env.local");
  console.error("Supabase Dashboard → Project Settings → API → service_role (secret)");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const BUCKET = "post-attachments";
const MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "model/gltf-binary",
  "application/octet-stream",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "application/zip",
  "application/x-zip-compressed",
];

async function main() {
  const { data: existing } = await admin.storage.getBucket(BUCKET);

  if (!existing) {
    const { error } = await admin.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: 52_428_800,
      allowedMimeTypes: MIME_TYPES,
    });
    if (error && !error.message.toLowerCase().includes("already exists")) {
      throw new Error(`createBucket: ${error.message}`);
    }
    console.log(`Created bucket "${BUCKET}".`);
  } else {
    const { error } = await admin.storage.updateBucket(BUCKET, {
      public: true,
      fileSizeLimit: 52_428_800,
      allowedMimeTypes: MIME_TYPES,
    });
    if (error) throw new Error(`updateBucket: ${error.message}`);
    console.log(`Updated bucket "${BUCKET}" mime types (includes GLB).`);
  }

  const sqlPath = resolve(process.cwd(), "supabase/migrations/017_profile_avatar_storage.sql");
  console.log("\nNext: run SQL policies in Supabase Dashboard → SQL Editor:");
  console.log(`  ${sqlPath}`);
  console.log("\nOr paste migrations 017 + 019 if policies are missing.");
  console.log("\nStorage bucket is ready for avatar uploads.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
