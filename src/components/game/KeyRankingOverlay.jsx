import React from "react";
import { Crown, KeyRound, Sparkles, X } from "lucide-react";

function KeyRankingOverlayComponent({ open, onClose, rankingSnapshot }) {
  if (!open || !rankingSnapshot) return null;

  const { seasonLabel, totalKeys, playerEntry, topRanking, nextRewardTier } = rankingSnapshot;

  return (
    <div className="absolute inset-0 z-[120] bg-slate-950/74 backdrop-blur-[4px]">
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col px-4 pb-6 pt-5">
        <div className="flex items-center justify-between">
          <div className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-100">
            {seasonLabel}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white"
            title="Fechar ranking"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(251,191,36,0.14),rgba(15,23,42,0.84))] p-5 shadow-[0_24px_90px_rgba(8,15,30,0.45)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-100/80">Ranking global</p>
              <h2 className="mt-2 text-2xl font-black text-white">Liga das chaves</h2>
              <p className="mt-2 text-sm text-slate-200">As chaves acumuladas fora da run definem sua posicao nesta temporada.</p>
            </div>
            <div className="rounded-[1.4rem] border border-amber-300/25 bg-amber-300/12 p-3 text-amber-100">
              <KeyRound className="h-6 w-6" />
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-[1.4rem] border border-white/10 bg-black/18 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-100/70">Suas chaves</p>
              <p className="mt-2 text-3xl font-black text-white">{totalKeys.toLocaleString("pt-BR")}</p>
            </div>
            <div className="rounded-[1.4rem] border border-white/10 bg-black/18 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100/70">Posicao atual</p>
              <p className="mt-2 text-3xl font-black text-white">#{playerEntry.position}</p>
            </div>
          </div>

          <div className="mt-4 rounded-[1.4rem] border border-cyan-300/20 bg-cyan-300/10 p-4">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-5 w-5 text-cyan-100" />
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100/75">Proxima meta</p>
                {nextRewardTier ? (
                  <>
                    <p className="mt-1 text-sm font-black text-white">{nextRewardTier.label}</p>
                    <p className="mt-1 text-sm text-slate-200">
                      {`Falta ${Math.max(0, Number(nextRewardTier.minKeys || 0) - totalKeys)} chaves - ${nextRewardTier.reward}`}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="mt-1 text-sm font-black text-white">Meta maxima atingida</p>
                    <p className="mt-1 text-sm text-slate-200">Voce ja passou por todas as metas configuradas desta temporada.</p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 p-4 shadow-[0_24px_90px_rgba(8,15,30,0.32)] backdrop-blur-md">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-100/80">Top ranking</p>
            <Crown className="h-4 w-4 text-amber-200" />
          </div>
          <div className="mt-4 space-y-2">
            {topRanking.map((entry) => (
              <div
                key={entry.id}
                className={`flex items-center justify-between rounded-[1.2rem] border px-3 py-3 ${
                  entry.isPlayer ? "border-cyan-300/35 bg-cyan-300/10" : "border-white/8 bg-black/16"
                }`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-black text-white">
                    #{entry.position} {entry.name}
                  </p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-slate-300">
                    {entry.isPlayer ? "Voce" : "Jogador"}
                  </p>
                </div>
                <div className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-sm font-black text-amber-100">
                  {entry.keys.toLocaleString("pt-BR")}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const KeyRankingOverlay = React.memo(KeyRankingOverlayComponent);

export default KeyRankingOverlay;
