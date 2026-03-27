export function isCycleActive(cycle) {
  return Boolean(cycle?.active);
}

export function isCyclePending(cycle) {
  return Boolean(cycle) && !Boolean(cycle?.raffle_completed);
}

export function resolveCurrentDepositCycle(cycles = []) {
  const safeCycles = Array.isArray(cycles) ? cycles : [];
  return safeCycles.find(isCycleActive) || safeCycles.find(isCyclePending) || null;
}

export function resolveEndedDepositCycles(cycles = []) {
  const safeCycles = Array.isArray(cycles) ? cycles : [];
  const currentCycle = resolveCurrentDepositCycle(safeCycles);
  return safeCycles.filter((cycle) => String(cycle?.id || "") !== String(currentCycle?.id || ""));
}
