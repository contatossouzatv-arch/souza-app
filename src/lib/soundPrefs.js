const MENU_SOUND_KEY = "souza_sound_menu_enabled_v1";
const INTERACTION_SOUND_KEY = "souza_sound_interaction_enabled_v1";
const GAME_MUSIC_ENABLED_KEY = "souza_game_music_enabled_v1";
const GAME_MUSIC_VOLUME_KEY = "souza_game_music_volume_v1";

function readFlag(key, fallback = true) {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return raw === "1";
  } catch {
    return fallback;
  }
}

function writeFlag(key, enabled) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, enabled ? "1" : "0");
    dispatchSoundPrefsChanged();
  } catch {
    // noop
  }
}

function readVolume(key, fallback = 0.1) {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = Number(window.localStorage.getItem(key));
    if (!Number.isFinite(raw)) return fallback;
    return Math.max(0, Math.min(1, raw));
  } catch {
    return fallback;
  }
}

function writeVolume(key, value) {
  if (typeof window === "undefined") return;
  try {
    const safeValue = Math.max(0, Math.min(1, Number(value) || 0));
    window.localStorage.setItem(key, String(safeValue));
    dispatchSoundPrefsChanged();
  } catch {
    // noop
  }
}

function dispatchSoundPrefsChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("souza:sound-prefs-changed", {
      detail: getSoundPrefs(),
    })
  );
}

export function isMenuSoundEnabled() {
  return readFlag(MENU_SOUND_KEY, true);
}

export function isInteractionSoundEnabled() {
  return readFlag(INTERACTION_SOUND_KEY, true);
}

export function setMenuSoundEnabled(enabled) {
  writeFlag(MENU_SOUND_KEY, Boolean(enabled));
}

export function setInteractionSoundEnabled(enabled) {
  writeFlag(INTERACTION_SOUND_KEY, Boolean(enabled));
}

export function getSoundPrefs() {
  return {
    menu: isMenuSoundEnabled(),
    interaction: isInteractionSoundEnabled(),
    gameMusicEnabled: readFlag(GAME_MUSIC_ENABLED_KEY, true),
    gameMusicVolume: readVolume(GAME_MUSIC_VOLUME_KEY, 0.1),
  };
}

export function isGameMusicEnabled() {
  return readFlag(GAME_MUSIC_ENABLED_KEY, true);
}

export function getGameMusicVolume() {
  return readVolume(GAME_MUSIC_VOLUME_KEY, 0.1);
}

export function setGameMusicEnabled(enabled) {
  writeFlag(GAME_MUSIC_ENABLED_KEY, Boolean(enabled));
}

export function setGameMusicVolume(value) {
  writeVolume(GAME_MUSIC_VOLUME_KEY, value);
}
