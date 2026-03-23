import React, { lazy, Suspense } from "react";
import confetti from "canvas-confetti";
import { useNavigate } from "react-router-dom";
import { toast } from "@/components/ui/use-toast";
import { useDailyChestState } from "@/hooks/useDailyChestState";
import DailyChestOverlay from "@/components/daily-chest/DailyChestOverlay";
import { filterAvailableDailyChestRewards, formatDailyChestPrize } from "@/lib/dailyChest";
import menuClickSound from "../../assets-para-app/Songs/Song click menu principal.mp3";
import chestOpenSound from "../../assets-para-app/Songs/Song Bau final da partida se abrindo.mp3";
import commonRewardCollectSound from "../../assets-para-app/Songs/Song Coleta coisa comum no final da partida ou de baus no lobby.mp3";
import chestTurnSound from "../../assets-para-app/Songs/Song girar bau para abrir.mp3";
import { isInteractionSoundEnabled, isMenuSoundEnabled } from "@/lib/soundPrefs";

const DailyChestScene = lazy(() => import("@/components/daily-chest/DailyChestScene"));

function SceneLoader() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.18),transparent_28%),linear-gradient(180deg,#020617_0%,#06111d_45%,#030712_100%)] px-6 text-center">
      <div className="max-w-md rounded-[2rem] border border-cyan-200/15 bg-slate-950/75 px-6 py-7 shadow-[0_24px_80px_rgba(2,6,23,0.45)]">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-cyan-300/20 border-t-cyan-300" />
        <p className="mt-4 text-lg font-black text-cyan-100">Preparando o Baú Diário</p>
        <p className="mt-2 text-sm text-slate-300">
          Carregando cenário, texturas e efeitos para abrir tudo já pronto.
        </p>
      </div>
    </div>
  );
}

function resolveRewardMessage(reward, state) {
  const baseMessage = String(
    reward?.subtitle ||
    reward?.messageOfDay ||
    reward?.message_of_day ||
    reward?.specialLabel ||
    reward?.special_label ||
    state?.messageOfDay ||
    ""
  ).trim();
  const rewardType = String(reward?.rewardType || reward?.reward_type || "").trim().toLowerCase();
  if (["points_balance", "saldo", "bonus", "cash_prize"].includes(rewardType)) {
    const adminNotice = "Verifique sua galeria de prêmios para saber qual ADM chamar.";
    if (!baseMessage) return adminNotice;
    return `${baseMessage} ${adminNotice}`.trim();
  }
  return baseMessage;
}

export default function DailyChestHub() {
  const navigate = useNavigate();
  const [tapCount, setTapCount] = React.useState(0);
  const [tapPulseToken, setTapPulseToken] = React.useState(0);
  const [spinToken, setSpinToken] = React.useState(0);
  const [displayState, setDisplayState] = React.useState("available");
  const [viewMode, setViewMode] = React.useState("main");
  const [sceneReady, setSceneReady] = React.useState(false);
  const menuAudioRef = React.useRef(null);
  const spinAudioRef = React.useRef(null);
  const openAudioRef = React.useRef(null);
  const collectAudioRef = React.useRef(null);
  const lastRevealStateRef = React.useRef(null);
  const { state, isLoading, error, refetch, openChest, unlockChest, claimChest, isOpening, isUnlocking, isClaiming } = useDailyChestState();

  const playAudio = React.useCallback((audioRef, enabled, volume = 0.9) => {
    if (!enabled) return;
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    audio.volume = volume;
    audio.play().catch(() => {});
  }, []);

  React.useEffect(() => {
    const menuAudio = new Audio(menuClickSound);
    menuAudio.preload = "auto";
    menuAudioRef.current = menuAudio;

    const spinAudio = new Audio(chestTurnSound);
    spinAudio.preload = "auto";
    spinAudioRef.current = spinAudio;

    const openAudio = new Audio(chestOpenSound);
    openAudio.preload = "auto";
    openAudioRef.current = openAudio;

    const collectAudio = new Audio(commonRewardCollectSound);
    collectAudio.preload = "auto";
    collectAudioRef.current = collectAudio;

    return () => {
      menuAudioRef.current = null;
      spinAudioRef.current = null;
      openAudioRef.current = null;
      collectAudioRef.current = null;
    };
  }, []);

  React.useEffect(() => {
    if (!state) return;
    const backendState = String(state.state || "available");
    setDisplayState((current) => {
      if (current === "opening" && !["opened", "claimed", "cooldown"].includes(backendState)) {
        return current;
      }
      return backendState;
    });
    setViewMode("main");
    if (displayState === "opening" && !["opened", "claimed", "cooldown"].includes(backendState)) {
      return;
    }
    if (backendState === "available") {
      setTapCount(0);
      return;
    }
    setTapCount(Number(state.tapGoal || 0));
  }, [displayState, state]);

  React.useEffect(() => {
    if (displayState !== "opened" || lastRevealStateRef.current === "opened") return;
    lastRevealStateRef.current = "opened";
    playAudio(openAudioRef, isInteractionSoundEnabled(), 0.92);
    confetti({
      particleCount: 140,
      spread: 84,
      startVelocity: 36,
      scalar: 0.95,
      origin: { x: 0.5, y: 0.52 },
      colors: ["#67e8f9", "#22d3ee", "#c084fc", "#fef08a", "#ffffff"],
    });
  }, [displayState, playAudio]);

  React.useEffect(() => {
    if (displayState === "available") {
      lastRevealStateRef.current = null;
    }
  }, [displayState]);

  const availableRewardPool = React.useMemo(() => filterAvailableDailyChestRewards(state?.rewardPool || []), [state?.rewardPool]);

  React.useEffect(() => {
    if (viewMode === "rewards" && availableRewardPool.length === 0) {
      setViewMode("main");
    }
  }, [availableRewardPool.length, viewMode]);

  const handleSpin = React.useCallback(async (slotType = "base") => {
    if (!state || isOpening) return;
    const remainingForType =
      slotType === "bonus"
        ? Math.max(0, Number(state?.slots?.availableBonus || 0))
        : Math.max(0, Number(state?.slots?.availableBase || 0));
    if (remainingForType <= 0) return;

    const tapGoal = Math.max(1, Number(state.tapGoal || 4));
    const nextTapCount = Math.min(tapGoal, Number(tapCount || 0) + 1);
    setTapCount(nextTapCount);
    setTapPulseToken((value) => value + 1);
    if (nextTapCount < tapGoal) {
      return;
    }
    setSpinToken((value) => value + 1);
    setDisplayState("opening");
    playAudio(spinAudioRef, isInteractionSoundEnabled(), 0.9);

    try {
      await new Promise((resolve) => window.setTimeout(resolve, 900));
      const nextState = await openChest(slotType);
      setDisplayState(String(nextState?.state || "opened"));
    } catch (openError) {
      setDisplayState("available");
      setTapCount(0);
      toast({
        title: "Não foi possível abrir",
        description: openError?.message || "Tente novamente em instantes.",
      });
    }
  }, [isOpening, openChest, playAudio, state, tapCount]);

  const handleUnlock = React.useCallback(async (code) => {
    try {
      const nextState = await unlockChest(code);
      setDisplayState(String(nextState?.state || "available"));
      toast({
        title: "Baú liberado",
        description: "O giro diário foi destravado com sucesso.",
      });
    } catch (unlockError) {
      toast({
        title: "Não foi possível liberar",
        description: unlockError?.message || "Confira o código e tente novamente.",
      });
      throw unlockError;
    }
  }, [unlockChest]);

  const handleClaim = React.useCallback(async () => {
    try {
      playAudio(collectAudioRef, isInteractionSoundEnabled(), 0.92);
      const nextState = await claimChest();
      setDisplayState(String(nextState?.state || "claimed"));
      toast({
        title: "Prêmio resgatado",
        description: "O Baú Diário foi concluído com sucesso.",
      });
    } catch (claimError) {
      toast({
        title: "Falha ao resgatar",
        description: claimError?.message || "O prêmio continua salvo. Tente novamente.",
      });
    }
  }, [claimChest, playAudio]);

  if (isLoading) {
    return <SceneLoader />;
  }

  if (error || !state) {
    return (
      <div className="flex h-[100dvh] max-h-[100dvh] items-center justify-center overflow-hidden bg-slate-950 px-4 text-white">
        <div className="max-w-sm rounded-[2rem] border border-white/10 bg-slate-950/80 p-6 text-center">
          <p className="text-lg font-black">Falha ao carregar o Baú Diário</p>
          <p className="mt-2 text-sm text-slate-400">A experiência continua salva no backend. Tente novamente.</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-5 rounded-2xl bg-cyan-400 px-4 py-2 font-bold text-slate-950"
          >
            Tentar de novo
          </button>
        </div>
      </div>
    );
  }

  const reward = state.opening?.rewardSnapshot || state.rewardPreview || {};
  const rewardMessage = resolveRewardMessage(reward, state);
  const sceneState =
    displayState === "claimed" || displayState === "cooldown"
      ? "claimed"
      : displayState === "opened"
      ? "opened"
      : displayState;

  return (
    <div className="relative h-[100dvh] max-h-[100dvh] overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.18),transparent_32%),linear-gradient(180deg,#020617_0%,#04111d_48%,#030712_100%)]" />
      <div className="absolute inset-0 lg:flex lg:items-center lg:justify-center lg:p-6">
        <div className="h-full w-full lg:h-[min(100dvh-3rem,100vw-3rem)] lg:w-[min(100dvh-3rem,100vw-3rem)] lg:overflow-hidden lg:rounded-[2rem] lg:border lg:border-white/10 lg:bg-slate-950/40 lg:shadow-[0_24px_80px_rgba(2,6,23,0.45)]">
          <Suspense fallback={<SceneLoader />}>
            <DailyChestScene
              onSceneReady={() => setSceneReady(true)}
              stageState={sceneState}
              viewMode={viewMode}
              tapProgress={tapCount}
              tapGoal={Number(state.tapGoal || 4)}
              rarity={reward.rarity}
              theme={state.theme?.sceneTheme}
              tapPulseToken={tapPulseToken}
              spinToken={spinToken}
              rewardLabel={formatDailyChestPrize(reward)}
              rewardDescription={rewardMessage}
              rewardPool={availableRewardPool}
              slotSummary={state.slots || {}}
              statusInfo={{
                title:
                  displayState === "opening"
                    ? "Girando o baú"
                    : displayState === "opened"
                    ? "Prêmio liberado"
                    : displayState === "claimed"
                    ? "Baú concluído hoje"
                    : displayState === "cooldown"
                    ? "Sem giros restantes"
                    : displayState === "locked"
                    ? "Baú temporariamente desativado"
                    : "Baú Diário",
                body:
                  displayState === "opening"
                    ? "O giro já começou e o resultado está sendo liberado."
                    : displayState === "opened"
                    ? "Seu resultado já saiu. Agora é só resgatar."
                    : displayState === "claimed"
                    ? `Novo reset em ${state?.resetAt ? new Date(state.resetAt).toLocaleString("pt-BR") : "-"}.`
                    : displayState === "cooldown"
                    ? `Seu próximo baú volta em ${state?.resetAt ? new Date(state.resetAt).toLocaleString("pt-BR") : "-"}.`
                    : displayState === "locked"
                    ? "A abertura está travada por enquanto."
                    : "Gire o baú para revelar a recompensa do dia.",
              }}
            />
          </Suspense>
          {!sceneReady ? (
            <div className="pointer-events-auto absolute inset-0 z-30">
              <SceneLoader />
            </div>
          ) : null}
        </div>
      </div>

      {sceneReady ? (
        <DailyChestOverlay
          displayState={displayState}
          state={state}
          tapCount={tapCount}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          hasRewardsAvailable={availableRewardPool.length > 0}
          onTap={handleSpin}
          onUnlock={handleUnlock}
          onClaim={handleClaim}
          rewardMessage={rewardMessage}
          onBack={() => navigate("/")}
          onMenuOpenSound={() => playAudio(menuAudioRef, isMenuSoundEnabled(), 0.88)}
          isClaiming={isClaiming}
          isOpening={isOpening}
          isUnlocking={isUnlocking}
        />
      ) : null}
    </div>
  );
}
