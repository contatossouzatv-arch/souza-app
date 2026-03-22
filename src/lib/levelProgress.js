function toSafePoints(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.floor(parsed));
}

function xpRequiredForLevel(level) {
  const safeLevel = Math.max(1, Number(level || 1));
  const base = 120;
  const growth = 1.28;
  return Math.floor(base * Math.pow(growth, safeLevel - 1));
}

export function getLevelProgress(totalPoints) {
  const points = toSafePoints(totalPoints);
  let level = 1;
  let spent = 0;
  let required = xpRequiredForLevel(level);

  while (points >= spent + required) {
    spent += required;
    level += 1;
    required = xpRequiredForLevel(level);
    if (level > 999) break;
  }

  const inLevel = points - spent;
  const pointsToNext = Math.max(0, required - inLevel);
  const progressPct = required > 0 ? Math.min(100, Math.round((inLevel / required) * 100)) : 0;

  return {
    totalPoints: points,
    level,
    inLevelPoints: inLevel,
    pointsRequired: required,
    pointsToNext,
    progressPct,
  };
}
