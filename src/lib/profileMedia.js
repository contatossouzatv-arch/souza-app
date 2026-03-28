import { resolveAssetUrl } from "@/api/base44Client";

export function getProfileAvatarSrc(profile, avatarSrcById = {}, fallbackSrc = "") {
  if (!profile || typeof profile !== "object") {
    return fallbackSrc || "";
  }

  const hasApprovedPhoto =
    String(profile.profile_image_mode || "").toLowerCase() === "photo" &&
    String(profile.profile_image_status || "").toLowerCase() === "approved";

  if (hasApprovedPhoto) {
    const approvedPhotoUrl =
      String(profile.profile_image_url || "").trim() ||
      (profile.id ? `/api/auth/profile-image/${profile.id}` : "");
    if (approvedPhotoUrl) {
      return resolveAssetUrl(approvedPhotoUrl);
    }
  }

  const avatarId = String(profile.profile_avatar_id || "").trim();
  if (avatarId && avatarSrcById[avatarId]) {
    return avatarSrcById[avatarId];
  }

  return fallbackSrc || "";
}

export function getProfileAvatarFallback(profile, fallback = "U") {
  const emoji = String(profile?.avatar_emoji || "").trim();
  if (emoji) return emoji;

  const nick = String(profile?.nick || profile?.full_name || "").trim();
  if (nick) return nick.charAt(0).toUpperCase();

  return fallback;
}
