import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseUrl } from "@/lib/supabase/env";

export const INVESTOR_AVATARS_BUCKET = "investor-avatars";

const MAX_BYTES = 5 * 1024 * 1024;

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

/** Extract `userId/foo.jpg` after `/object/public/investor-avatars/`. */
export function storagePathFromPublicAvatarUrl(
  fullUrl: string | null | undefined,
): string | null {
  if (!fullUrl?.trim()) return null;
  const marker = `/object/public/${INVESTOR_AVATARS_BUCKET}/`;
  const i = fullUrl.indexOf(marker);
  if (i === -1) return null;
  try {
    return decodeURIComponent(fullUrl.slice(i + marker.length));
  } catch {
    return null;
  }
}

async function emptyUserAvatarFolder(client: SupabaseClient, userId: string) {
  const { data: files } = await client.storage
    .from(INVESTOR_AVATARS_BUCKET)
    .list(userId, { limit: 100 });

  if (!files?.length) return;

  const paths = files
    .filter((f) => f.name)
    .map((f) => `${userId}/${f.name}`);
  if (paths.length === 0) return;

  await client.storage.from(INVESTOR_AVATARS_BUCKET).remove(paths);
}

export type UploadInvestorAvatarResult =
  | { ok: true; publicUrl: string }
  | { ok: false; message: string };

export async function uploadInvestorAvatar(
  client: SupabaseClient,
  userId: string,
  file: File,
): Promise<UploadInvestorAvatarResult> {
  if (!ACCEPT_MIME.has(file.type)) {
    return { ok: false, message: "Use a JPEG, PNG, WebP, or GIF image." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, message: "Image must be 5 MB or smaller." };
  }

  const ext = mimeToExt(file.type);
  if (!ext) {
    return { ok: false, message: "Unsupported image format." };
  }

  await emptyUserAvatarFolder(client, userId);

  const path = `${userId}/avatar.${ext}`;
  const { error: uploadError } = await client.storage
    .from(INVESTOR_AVATARS_BUCKET)
    .upload(path, file, {
      upsert: true,
      cacheControl: "3600",
      contentType: file.type,
    });

  if (uploadError) {
    return { ok: false, message: uploadError.message };
  }

  const root = getSupabaseUrl().replace(/\/$/, "");
  const encodedPath = path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const publicUrl = `${root}/storage/v1/object/public/${INVESTOR_AVATARS_BUCKET}/${encodedPath}`;

  return { ok: true, publicUrl };
}

export async function removeInvestorAvatarFromStorage(
  client: SupabaseClient,
  publicUrl: string | null | undefined,
): Promise<void> {
  const path = storagePathFromPublicAvatarUrl(publicUrl);
  if (!path) return;

  await client.storage.from(INVESTOR_AVATARS_BUCKET).remove([path]);
}
