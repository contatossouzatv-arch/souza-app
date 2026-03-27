import fs from "node:fs";
import path from "node:path";
import {
  getUserProfileImageVersion,
  getUserProfileImages,
  pool,
  updateUserById,
} from "../src/db/index.js";
import { getCloudinaryConfig, uploadToCloudinary } from "../src/lib/cloudinary.js";
import { uploadsDir } from "../src/lib/paths.js";

const cloudinaryConfig = getCloudinaryConfig();
const dryRun = String(process.env.DRY_RUN || "false").toLowerCase() === "true";
const force = String(process.env.FORCE || "false").toLowerCase() === "true";

function isCloudinaryUrl(value = "") {
  return String(value || "").includes("cloudinary.com");
}

function extractProfileImageVersionId(value = "") {
  const match = String(value || "").match(/\/api\/auth\/profile-image-version\/([^/?#]+)/i);
  return match?.[1] || "";
}

async function resolveSourceBinary(user) {
  const image = await getUserProfileImages(user.id);
  if (image?.approved_data) {
    return {
      buffer: image.approved_data,
      mimetype: image.approved_mime_type || "image/jpeg",
      originalName: image.approved_file_name || `profile-${user.id}.jpg`,
      source: "approved_data",
    };
  }

  const versionId = extractProfileImageVersionId(user.profile_image_url);
  if (versionId) {
    const version = await getUserProfileImageVersion(versionId);
    if (version?.data) {
      return {
        buffer: version.data,
        mimetype: version.mime_type || "image/jpeg",
        originalName: version.file_name || `profile-${user.id}.jpg`,
        source: "profile_image_version",
      };
    }
  }

  const marker = "/uploads/profile/";
  const currentUrl = String(user.profile_image_url || "").trim();
  const markerIndex = currentUrl.indexOf(marker);
  if (markerIndex !== -1) {
    const fileName = currentUrl.slice(markerIndex + marker.length);
    if (fileName && !fileName.includes("/") && !fileName.includes("\\")) {
      const filePath = path.resolve(uploadsDir, "profile", fileName);
      if (fs.existsSync(filePath)) {
        return {
          buffer: await fs.promises.readFile(filePath),
          mimetype: "image/jpeg",
          originalName: fileName,
          source: "local_public_file",
        };
      }
    }
  }

  return null;
}

async function migrateUserProfileImage(user) {
  if (!user?.id) return { status: "skipped", reason: "missing_user_id" };
  if (!force && isCloudinaryUrl(user.profile_image_url)) {
    return { status: "skipped", reason: "already_cloudinary" };
  }

  const image = await resolveSourceBinary(user);
  if (!image?.buffer) {
    return { status: "missing", reason: "no_supported_image_source" };
  }

  const folder = [cloudinaryConfig.folder, "profile-images"].filter(Boolean).join("/");
  const originalName = image.originalName || `profile-${user.id}.jpg`;
  if (dryRun) {
    return { status: "dry_run", reason: `${image.source}:${originalName}` };
  }

  const upload = await uploadToCloudinary({
    buffer: image.buffer,
    mimetype: image.mimetype || "image/jpeg",
    originalName,
    folder,
    publicId: `users/${user.id}/profile-current`,
  });

  await updateUserById(user.id, {
    profile_image_mode: "photo",
    profile_image_status: "approved",
    profile_image_url: upload.url,
  });

  return { status: "uploaded", url: upload.url, source: image.source };
}

async function main() {
  if (!cloudinaryConfig.enabled) {
    throw new Error("Cloudinary is not configured");
  }

  const result = await pool.query(
    `SELECT id, nick, full_name, profile_image_url
       FROM users
      WHERE profile_image_status = 'approved'
        AND profile_image_mode = 'photo'
      ORDER BY updated_at DESC`
  );

  const summary = {
    total: result.rows.length,
    uploaded: 0,
    skipped: 0,
    missing: 0,
    failed: 0,
  };

  for (const user of result.rows) {
    try {
      const outcome = await migrateUserProfileImage(user);
      if (outcome.status === "uploaded") summary.uploaded += 1;
      else if (outcome.status === "missing") summary.missing += 1;
      else summary.skipped += 1;

      console.log("[profile-image-migration] user", {
        userId: user.id,
        nick: user.nick || "",
        status: outcome.status,
        reason: outcome.reason || null,
        source: outcome.source || null,
        url: outcome.url || null,
      });
    } catch (error) {
      summary.failed += 1;
      console.error("[profile-image-migration] failed", {
        userId: user.id,
        nick: user.nick || "",
        message: error?.message || "Unknown migration error",
      });
    }
  }

  console.log("[profile-image-migration] summary", summary);
  await pool.end();
}

main().catch((error) => {
  console.error("[profile-image-migration] fatal", {
    message: error?.message || "Unknown fatal migration error",
    stack: error?.stack || null,
  });
  process.exit(1);
});
