import React from "react";

function formatRemainingLabel(ms) {
  const totalMs = Math.max(0, Number(ms || 0));
  if (totalMs <= 0) return "0.0s";
  if (totalMs < 10000) return `${(totalMs / 1000).toFixed(1)}s`;
  return `${Math.ceil(totalMs / 1000)}s`;
}

function formatPowerLabel(powerUp) {
  const type = String(powerUp?.tipo || "");
  if (type === "money_multiplier") return "Bonus";
  if (type === "shield") return "Escudo";
  if (type === "slow_motion") return "Lento";
  return "Ativo";
}

function formatPowerAccent(powerUp) {
  const type = String(powerUp?.tipo || "");
  if (type === "money_multiplier") return "border-amber-300/35 bg-amber-400/12 text-amber-100";
  if (type === "shield") return "border-emerald-300/35 bg-emerald-400/12 text-emerald-100";
  if (type === "slow_motion") return "border-cyan-300/35 bg-cyan-400/12 text-cyan-100";
  return "border-white/15 bg-white/8 text-white";
}

function RunnerStatusCompactComponent({ runnerState }) {
  const activePowerUps = Array.isArray(runnerState?.powerUpsAtivos) ? runnerState.powerUpsAtivos : [];
  const shieldCharges = Math.max(0, Number(runnerState?.shieldCharges || 0));
  const coinMultiplier = Math.max(1, Number(runnerState?.coinMultiplierAtual || 1));
  const slowMotionActive = Boolean(runnerState?.slowMotionAtivo);
  const perkIds = Array.isArray(runnerState?.loadout?.perkIds) ? runnerState.loadout.perkIds : [];

  const shouldRender =
    activePowerUps.length > 0 || shieldCharges > 0 || coinMultiplier > 1.01 || slowMotionActive || perkIds.length > 0;
  if (!shouldRender) return null;

  return (
    <div className="pointer-events-none absolute right-4 top-[5.85rem] z-40 w-[min(19rem,calc(100vw-1.5rem))] rounded-2xl border border-white/10 bg-black/74 px-3 py-3 shadow-[0_16px_34px_rgba(2,6,23,0.2)] backdrop-blur-[6px]">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/72">Status da run</p>
          <p className="mt-1 text-xs font-semibold text-white">
            x{coinMultiplier.toFixed(coinMultiplier % 1 === 0 ? 0 : 1)} moedas
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/56">Perks</p>
          <p className="mt-1 text-xs font-semibold text-white/88">{perkIds.length || 0} ativos</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {shieldCharges > 0 ? (
          <div className="rounded-full border border-emerald-300/35 bg-emerald-400/12 px-3 py-1 text-[11px] font-semibold text-emerald-100">
            Escudo x{shieldCharges}
          </div>
        ) : null}
        {slowMotionActive ? (
          <div className="rounded-full border border-cyan-300/35 bg-cyan-400/12 px-3 py-1 text-[11px] font-semibold text-cyan-100">
            Slow motion
          </div>
        ) : null}
      </div>

      {activePowerUps.length ? (
        <div className="mt-3 space-y-2">
          {activePowerUps.map((powerUp) => (
            <div
              key={`${powerUp.id}-${powerUp.tipo}`}
              className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 ${formatPowerAccent(powerUp)}`}
            >
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-[0.18em]">{formatPowerLabel(powerUp)}</p>
                <p className="mt-1 text-[11px] opacity-90">{formatRemainingLabel(powerUp.duracaoRestanteMs)}</p>
              </div>
              {Number(powerUp.charges || 0) > 0 ? (
                <span className="text-[11px] font-bold">x{Math.max(0, Number(powerUp.charges || 0))}</span>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

const RunnerStatusCompact = React.memo(RunnerStatusCompactComponent);

export default RunnerStatusCompact;
