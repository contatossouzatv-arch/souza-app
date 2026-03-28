import { resolveAssetUrl } from "@/api/base44Client";

export function getProfileAvatarSrc(profile, avatarSrcById = {}, fallbackSrc = "") {
  if (!profile || typeof profile !== "object") {
    return fallbackSrc || "";
  }

  const rawProfileImageUrl = String(profile.profile_image_url || "").trim();
  const hasApprovedPhoto = String(profile.profile_image_status || "").toLowerCase() === "approved";

  if (rawProfileImageUrl) {
    return resolveAssetUrl(rawProfileImageUrl);
  }

  if (hasApprovedPhoto && profile.id) {
    return resolveAssetUrl(`/api/auth/profile-image/${profile.id}`);
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
