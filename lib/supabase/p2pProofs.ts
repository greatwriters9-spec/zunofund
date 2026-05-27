import type { SupabaseClient } from "@supabase/supabase-js";

export const P2P_PAYMENT_PROOFS_BUCKET = "p2p-payment-proofs";

const MAX_BYTES = 8 * 1024 * 1024;
const ACCEPT_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function mimeToExt(mime: string): string | null {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return null;
  }
}

export type UploadP2pProofResult =
  | { ok: true; path: string; mimeType: string; fileName: string }
  | { ok: false; message: string };

export async function uploadP2pPaymentProof(
  client: SupabaseClient,
  orderId: string,
  userId: string,
  file: File,
): Promise<UploadP2pProofResult> {
  if (!ACCEPT_MIME.has(file.type)) {
    return { ok: false, message: "Use a JPEG, PNG, WebP, or GIF screenshot." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, message: "Screenshot must be 8 MB or smaller." };
  }

  const ext = mimeToExt(file.type);
  if (!ext) return { ok: false, message: "Unsupported screenshot format." };

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
  const path = `${orderId}/${userId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const { error } = await client.storage
    .from(P2P_PAYMENT_PROOFS_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });

  if (error) return { ok: false, message: error.message };

  return {
    ok: true,
    path,
    mimeType: file.type,
    fileName: safeName || `payment-proof.${ext}`,
  };
}

export async function createP2pProofSignedUrl(
  client: SupabaseClient,
  path: string | null | undefined,
): Promise<string | null> {
  if (!path?.trim()) return null;
  const { data, error } = await client.storage
    .from(P2P_PAYMENT_PROOFS_BUCKET)
    .createSignedUrl(path, 60 * 60);
  if (error) return null;
  return data.signedUrl;
}
