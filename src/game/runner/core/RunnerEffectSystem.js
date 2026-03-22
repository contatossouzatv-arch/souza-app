import { PERK_DEFINITIONS } from "@/game/runner/core/RunnerEntityDefinitions";

function getPerkDefinition(id) {
  return PERK_DEFINITIONS[id] || null;
}

export function createRunnerPerkModifiers(equippedPerkIds = []) {
  return equippedPerkIds.reduce(
    (modifiers, perkId) => {
      const definition = getPerkDefinition(perkId);
      const effect = definition?.effectDefinition || null;
      if (!effect) return modifiers;
      if (effect.type === "coin_bonus") {
        modifiers.coinMultiplier *= Number(effect.coinMultiplier || 1);
      } else if (effect.type === "diamond_chance") {
        modifiers.collectibleWeightMultipliers.diamond =
          (modifiers.collectibleWeightMultipliers.diamond || 1) * Number(effect.weightMultiplier || 1);
      } else if (effect.type === "power_up_duration") {
        modifiers.powerUpDurationMultiplier *= Number(effect.durationMultiplier || 1);
      }
      return modifiers;
    },
    {
      coinMultiplier: 1,
      powerUpDurationMultiplier: 1,
      collectibleWeightMultipliers: {},
    }
  );
}

export function activateRunnerPowerUp(runner, definition, modifiers = {}) {
  const effectDefinition = definition?.effectDefinition || null;
  if (!effectDefinition?.type) return null;

  const durationMultiplier = Number(modifiers.powerUpDurationMultiplier || 1);
  const activePowerUps = runner.activePowerUps || (runner.activePowerUps = {});
  const durationMs = Math.max(0, Number(definition.durationMs || 0) * durationMultiplier);
  const nextState = {
    id: definition.id,
    kind: definition.kind,
    effectDefinition,
    remainingMs: durationMs,
    stackBehavior: definition.stackBehavior || "refresh",
    charges: effectDefinition.type === "shield" ? 1 : 0,
  };

  const current = activePowerUps[definition.id] || null;
  if (current && nextState.stackBehavior === "refresh") {
    nextState.remainingMs = Math.max(current.remainingMs || 0, nextState.remainingMs);
    nextState.charges = Math.max(current.charges || 0, nextState.charges || 0);
  }

  activePowerUps[definition.id] = nextState;

  if (effectDefinition.type === "money_multiplier") {
    runner.moneyMultiplierTimer = Math.max(runner.moneyMultiplierTimer || 0, nextState.remainingMs);
    runner.moneyRainTimer = runner.moneyMultiplierTimer;
  }

  return nextState;
}

export function advanceRunnerPowerUps(runner, dt) {
  const activePowerUps = runner.activePowerUps || {};
  let moneyMultiplierTimer = 0;
  Object.keys(activePowerUps).forEach((powerUpId) => {
    const entry = activePowerUps[powerUpId];
    if (!entry) return;
    if (entry.remainingMs > 0) {
      entry.remainingMs = Math.max(0, entry.remainingMs - dt * 1000);
    }
    if (entry.effectDefinition?.type === "money_multiplier") {
      moneyMultiplierTimer = Math.max(moneyMultiplierTimer, entry.remainingMs || 0);
    }
    const expired = entry.remainingMs <= 0 && (entry.charges || 0) <= 0;
    if (expired) {
      delete activePowerUps[powerUpId];
    }
  });

  runner.moneyMultiplierTimer = moneyMultiplierTimer;
  runner.moneyRainTimer = moneyMultiplierTimer;
}

export function getRunnerCoinMultiplier(runner, modifiers = {}) {
  const perkCoinMultiplier = Number(modifiers.coinMultiplier || 1);
  const powerMultiplier = Object.values(runner.activePowerUps || {}).reduce((value, entry) => {
    if (entry?.effectDefinition?.type === "money_multiplier") {
      return value * Number(entry.effectDefinition.scoreMultiplier || 1);
    }
    return value;
  }, 1);
  return perkCoinMultiplier * powerMultiplier;
}

export function getRunnerSpeedMultiplier(runner) {
  return Object.values(runner.activePowerUps || {}).reduce((value, entry) => {
    if (entry?.effectDefinition?.type === "slow_motion") {
      return value * Number(entry.effectDefinition.speedMultiplier || 1);
    }
    return value;
  }, 1);
}

export function runnerHasShield(runner) {
  const shield = runner.activePowerUps?.shield || null;
  return Boolean(shield && (shield.charges || 0) > 0 && (shield.remainingMs || 0) > 0);
}

export function consumeRunnerShield(runner) {
  const shield = runner.activePowerUps?.shield || null;
  if (!shield || (shield.charges || 0) <= 0) return false;
  shield.charges = Math.max(0, Number(shield.charges || 0) - 1);
  if (shield.charges <= 0) {
    shield.remainingMs = 0;
    delete runner.activePowerUps.shield;
  }
  return true;
}

export function applyRunnerScoreGain(runner, rawGain) {
  const currentCarry = Number(runner.scoreFractionCarry || 0);
  const total = currentCarry + Number(rawGain || 0);
  const awarded = Math.floor(total);
  runner.scoreFractionCarry = total - awarded;
  runner.score += awarded;
  return awarded;
}
