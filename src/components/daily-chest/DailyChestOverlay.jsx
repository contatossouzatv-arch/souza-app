import React from "react";
import { ArrowLeft, Clock3, Gift, Link as LinkIcon, Lock, Sparkles, Stars, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCountdownLabel } from "@/lib/dailyChest";

const FORCE_DAILY_CHEST_FREE_ACCESS = true;

function InfoButton({ icon: Icon, label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border px-3 py-2 text-[11px] font-semibold tracking-[0.12em] backdrop-blur-xl transition ${
        active
          ? "border-cyan-300/45 bg-cyan-400/20 text-white shadow-[0_0_24px_rgba(34,211,238,0.18)]"
          : "border-white/10 bg-slate-950/72 text-slate-100 hover:bg-slate-900/88"
      }`}
    >
      <span className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${active ? "text-cyan-100" : "text-cyan-200"}`} />
        {label}
      </span>
    </button>
  );
}

function SpinButton({ title, count, disabled, accentClass, sublabel, onClick }) {
  return (
    <div className="w-full max-w-[12.75rem]">
      <Button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`h-16 w-full rounded-[1.55rem] text-sm font-black uppercase tracking-[0.08em] ${
          disabled ? "bg-white/10 text-slate-300 shadow-none" : accentClass
        }`}
      >
        {title} ({Math.max(0, Number(count || 0))})
      </Button>
      <p className="mt-2 px-2 text-center text-[11px] text-slate-300">{sublabel}</p>
    </div>
  );
}

export default function DailyChestOverlay({
  displayState,
  state,
  viewMode,
  hasRewardsAvailable = true,
  rewardMessage = "",
  onViewModeChange,
  onTap,
  onUnlock,
  onClaim,
  onBack,
  onMenuOpenSound,
  isClaiming,
  isOpening,
  isUnlocking,
}) {
  const [accessCode, setAccessCode] = React.useState("");
  const [showUnlockPrompt, setShowUnlockPrompt] = React.useState(false);
  const [, setNowTick] = React.useState(() => Date.now());

  React.useEffect(() => {
    const intervalId = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  React.useEffect(() => {
    if (state?.accessGate?.unlocked) {
      setAccessCode("");
      setShowUnlockPrompt(false);
    }
  }, [state?.accessGate?.unlocked]);

  const handleViewMode = React.useCallback(
    (nextMode) => {
      onMenuOpenSound?.();
      onViewModeChange?.(nextMode);
    },
    [onMenuOpenSound, onViewModeChange]
  );

  const slotSummary = state?.slots || {};
  const accessGate = FORCE_DAILY_CHEST_FREE_ACCESS
    ? { ...(state?.accessGate || {}), required: false, unlocked: true }
    : state?.accessGate || {};
  const effectiveAvailableBase =
    FORCE_DAILY_CHEST_FREE_ACCESS && !accessGate.required
      ? Math.max(0, Number(slotSummary.availableBase ?? slotSummary.remainingBase ?? 0))
      : Math.max(0, Number(slotSummary.availableBase || 0));
  const resetLabel = state?.resetAt ? formatCountdownLabel(state.resetAt) : "-";
  const rewardMessageText = String(rewardMessage || "").trim();
  const canSpinBase =
    viewMode === "main" &&
    displayState !== "opening" &&
    effectiveAvailableBase > 0 &&
    !isOpening;
  const canSpinBonus =
    viewMode === "main" &&
    displayState !== "opening" &&
    Math.max(0, Number(slotSummary.availableBonus || 0)) > 0 &&
    !isOpening;
  const showClaim = viewMode === "main" && displayState === "opened";
  const shouldShowUnlockPanel =
    showUnlockPrompt &&
    viewMode === "main" &&
    displayState !== "opened" &&
    displayState !== "claimed" &&
    accessGate.required &&
    !accessGate.unlocked &&
    Math.max(0, Number(slotSummary.remainingBase || 0)) > 0;

  const handleUnlockSubmit = async () => {
    const normalized = String(accessCode || "").trim();
    if (!normalized) return;
    await onUnlock?.(normalized);
  };

  const headline =
    displayState === "opened"
      ? "PARABENS!"
      : shouldShowUnlockPanel
      ? "LIBERE O BAU DIARIO"
      : Math.max(0, Number(slotSummary.remaining || 0)) > 0
      ? "GIROS DISPONÍVEIS"
      : `NOVO RESET EM ${resetLabel}`;

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between overflow-hidden px-3 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 text-white sm:px-5 sm:pb-5 sm:pt-5">
      <div className="flex items-start justify-between gap-3">
        <div className="max-w-[82%]">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-100 backdrop-blur-xl">
            <Sparkles className="h-3.5 w-3.5" />
            Evento
            <span className="text-emerald-300">Bau Diario</span>
          </div>
        </div>

        <Button
          type="button"
          onClick={onBack}
          variant="outline"
          className="pointer-events-auto h-10 rounded-2xl border-white/10 bg-slate-950/55 px-3 text-white hover:bg-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
      </div>

      <div className="pointer-events-none flex justify-center pt-2">
        <div className="max-w-[92vw] text-center">
          {viewMode === "rewards" ? (
            <p className="max-w-[min(92vw,820px)] text-balance text-[clamp(1.1rem,2.2vw,2rem)] font-black uppercase tracking-[0.12em] text-white drop-shadow-[0_8px_28px_rgba(8,145,178,0.45)]">
              PREMIOS DISPONIVEIS NO MOMENTO:
            </p>
          ) : (
            <>
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-cyan-100/92">{headline}</p>
              <p className="mt-2 text-sm text-slate-200">
                {showClaim
                  ? rewardMessageText || "Seu premio ja saiu. Agora e so resgatar."
                  : shouldShowUnlockPanel
                  ? "Digite o codigo publicado no grupo para liberar o bau do dia."
                  : "Os giros extras continuam liberados normalmente quando voce ganhar por deposito."}
              </p>
            </>
          )}
        </div>
      </div>

      <div className="pointer-events-none flex flex-1 items-center justify-center">
        {shouldShowUnlockPanel ? (
          <div className="pointer-events-auto w-full max-w-md rounded-[2rem] border border-cyan-300/20 bg-slate-950/78 p-5 shadow-[0_24px_80px_rgba(2,6,23,0.55)] backdrop-blur-xl">
            <p className="text-center text-xs font-black uppercase tracking-[0.24em] text-cyan-200">Liberar Bau</p>
            <div className="mt-4 space-y-3">
              <input
                value={accessCode}
                onChange={(event) => setAccessCode(event.target.value.toUpperCase())}
                placeholder="DIGITE O CODIGO"
                className="h-14 w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 text-center text-base font-black uppercase tracking-[0.24em] text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/50"
              />
              <Button
                type="button"
                onClick={handleUnlockSubmit}
                disabled={isUnlocking || !String(accessCode || "").trim()}
                className="h-12 w-full rounded-2xl bg-cyan-400 font-black text-slate-950 hover:bg-cyan-300"
              >
                {isUnlocking ? "Validando..." : "LIBERAR BAU"}
              </Button>
            </div>
            <div className="mt-4 rounded-2xl border border-white/8 bg-white/5 px-4 py-3 text-center text-xs leading-5 text-slate-300">
              <p>O código diário é liberado na comunidade do WhatsApp.</p>
              {accessGate.groupLink ? (
                <a
                  href={accessGate.groupLink}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-2 text-cyan-200 underline underline-offset-4"
                >
                  <LinkIcon className="h-3.5 w-3.5" />
                  Acesse por esse link e solicite a um adm se voce for novo
                </a>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <div className="pointer-events-auto space-y-3">
        <div className="flex justify-center">
          {showClaim ? (
            <Button
              type="button"
              onClick={onClaim}
              disabled={isClaiming}
              className="h-14 w-full max-w-sm rounded-[1.6rem] bg-emerald-400 text-base font-black text-slate-950 shadow-[0_18px_40px_rgba(74,222,128,0.32)] hover:bg-emerald-300"
            >
              <Gift className="mr-2 h-5 w-5" />
              {isClaiming ? "Resgatando..." : "Resgatar premio"}
            </Button>
          ) : viewMode !== "main" ? (
            <Button
              type="button"
              onClick={() => handleViewMode("main")}
              className="h-14 w-full max-w-sm rounded-[1.7rem] bg-cyan-400 text-base font-black text-slate-950 shadow-[0_18px_40px_rgba(34,211,238,0.32)] hover:bg-cyan-300"
            >
              <Sparkles className="mr-2 h-5 w-5" />
              Voltar ao bau
            </Button>
          ) : (
            <div className="flex w-full max-w-[26rem] gap-3">
              <SpinButton
                title="Giros Extras"
                count={slotSummary.remainingBonus}
                disabled={!canSpinBonus}
                accentClass="bg-emerald-400 text-slate-950 shadow-[0_18px_40px_rgba(74,222,128,0.24)] hover:bg-emerald-300"
                sublabel={
                  Math.max(0, Number(slotSummary.remainingBonus || 0)) > 0
                    ? "Liberados por depositos aprovados."
                    : "Sem extras disponíveis agora."
                }
                onClick={() => onTap?.("bonus")}
              />
              <SpinButton
                title={accessGate.required && !accessGate.unlocked ? "Liberar Bau" : "Bau Diario"}
                count={slotSummary.remainingBase}
                disabled={
                  accessGate.required && !accessGate.unlocked
                    ? false
                    : !canSpinBase
                }
                accentClass="bg-cyan-400 text-slate-950 shadow-[0_18px_40px_rgba(34,211,238,0.24)] hover:bg-cyan-300"
                sublabel={
                  accessGate.required && !accessGate.unlocked
                    ? "Click em liberar e digite o codigo de acesso!"
                    : Math.max(0, Number(slotSummary.remainingBase || 0)) > 0
                    ? "Seu giro diario resetado fica aqui."
                    : `Novo Bau em ${resetLabel}.`
                }
                onClick={() => {
                  if (accessGate.required && !accessGate.unlocked) {
                    setShowUnlockPrompt(true);
                    return;
                  }
                  onTap?.("base");
                }}
              />
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          {hasRewardsAvailable ? (
            <InfoButton
              icon={Trophy}
              label="Premios"
              active={viewMode === "rewards"}
              onClick={() => handleViewMode(viewMode === "rewards" ? "main" : "rewards")}
            />
          ) : null}
          <InfoButton
            icon={Clock3}
            label="Status"
            active={viewMode === "status"}
            onClick={() => handleViewMode(viewMode === "status" ? "main" : "status")}
          />
          <InfoButton
            icon={Sparkles}
            label="Regras"
            active={viewMode === "rules"}
            onClick={() => handleViewMode(viewMode === "rules" ? "main" : "rules")}
          />
          {accessGate.required && !accessGate.unlocked ? (
            <InfoButton
              icon={Lock}
              label="Codigo"
              active={shouldShowUnlockPanel}
              onClick={() => setShowUnlockPrompt((prev) => !prev)}
            />
          ) : null}
          {isOpening ? <InfoButton icon={Stars} label="Girando" active /> : null}
        </div>
      </div>
    </div>
  );
}
