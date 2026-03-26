import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { DAILY_CHEST_ROUTE_PATH } from "@/lib/featureFlags";
import { Sparkles, ShieldCheck } from "lucide-react";
import folhasTransicaoVideo from "../../assets-para-app/jogos/folhas transiçao.webm";
import { primeVideoPlayback, warmVideoAsset } from "@/lib/dailyEventMediaWarmup";
import { base44 } from "@/api/base44Client";
import { formatCountdownLabel } from "@/lib/dailyChest";

export default function DailyChestEntry({ onPress, loadState = false }) {
  const navigate = useNavigate();
  const openTimerRef = React.useRef(0);
  const overlayRef = React.useRef(null);
  const [, setNowTick] = React.useState(() => Date.now());
  const { data: chestState } = useQuery({
    queryKey: ["daily-chest-entry-state"],
    queryFn: () => base44.dailyChest.getState(),
    enabled: loadState,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  React.useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowTick(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
      if (openTimerRef.current) {
        window.clearTimeout(openTimerRef.current);
      }
    };
  }, []);

  const openDailyChest = () => {
    if (overlayRef.current) return;
    warmVideoAsset(folhasTransicaoVideo);
    primeVideoPlayback(folhasTransicaoVideo);
    onPress?.();
    const overlay = document.createElement("div");
    overlay.className = "pointer-events-none fixed inset-0 z-[9999] overflow-hidden";
    const video = document.createElement("video");
    video.className = "absolute inset-0 h-full w-full object-cover";
    video.src = folhasTransicaoVideo;
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.onended = () => {
      if (overlayRef.current?.parentNode) {
        overlayRef.current.parentNode.removeChild(overlayRef.current);
      }
      overlayRef.current = null;
    };
    overlay.appendChild(video);
    document.body.appendChild(overlay);
    overlayRef.current = overlay;
    openTimerRef.current = window.setTimeout(() => {
      navigate(DAILY_CHEST_ROUTE_PATH, {
        state: { playEntryTransition: false },
      });
    }, 500);
  };

  const remaining = Math.max(0, Number(chestState?.slots?.remaining || 0));
  const statusLabel = !loadState
    ? "Abra para conferir seus premios"
    : remaining > 0
      ? `${remaining} disponivel${remaining > 1 ? "is" : ""}`
      : `Proximo gratis em ${formatCountdownLabel(chestState?.resetAt)}`;

  return (
    <>
      <div className="pointer-events-none fixed left-0 right-0 top-0 z-40">
        <div className="mx-auto w-full max-w-md px-3 pt-3 sm:px-4">
          <button
            type="button"
            onClick={openDailyChest}
            className="pointer-events-auto w-full overflow-hidden rounded-2xl border border-emerald-300/25 bg-gradient-to-r from-emerald-500/25 via-cyan-500/20 to-emerald-500/25 p-[1px] shadow-[0_8px_30px_rgba(16,185,129,0.25)] transition-transform duration-150 active:scale-[0.99]"
          >
            <div className="relative rounded-[15px] border border-slate-700/40 bg-slate-900/85 px-4 py-3">
              <div className="pointer-events-none absolute -right-7 -top-8 h-24 w-24 rounded-full bg-emerald-400/20 blur-xl" />
              <div className="pointer-events-none absolute -left-10 -bottom-10 h-24 w-24 rounded-full bg-cyan-400/15 blur-xl" />
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-200">
                    <Sparkles className="h-5 w-5" />
                  </span>
                  <div className="text-left">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-200/90">Evento</p>
                    <p className="text-sm font-extrabold text-white">BAU DIARIO</p>
                    <p className="mt-0.5 text-[11px] text-slate-300">{statusLabel}</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-100">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {!loadState ? "ENTRAR" : remaining > 0 ? `${remaining} DISP.` : "ATIVO"}
                </span>
              </div>
            </div>
          </button>
        </div>
      </div>
    </>
  );
}
