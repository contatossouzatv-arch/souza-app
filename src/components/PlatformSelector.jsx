import React from "react";
import { ExternalLink } from "lucide-react";
import { usePlatformsSummary } from "@/hooks/usePlatformsSummary";

export default function PlatformSelector() {
  const { data: platforms = [] } = usePlatformsSummary({
    select: (data) => data?.activePlatforms || [],
  });

  if (platforms.length === 0) return null;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
      <p className="text-center text-sm font-semibold text-slate-200">PUBLICIDADE</p>
      <p className="mb-3 mt-1 text-center text-xs text-slate-400">
        Vai jogar? Jogue com responsabilidade porque não existe ganhos garantidos!
      </p>

      <div className="grid grid-cols-2 gap-3">
        {platforms.map((platform) => (
          <a
            key={platform.id}
            href={platform.link}
            target="_blank"
            rel="noopener noreferrer"
            className="group"
          >
            <div
              className="relative aspect-[2/1] overflow-hidden rounded-2xl border border-white/25 p-2.5 text-white transition hover:scale-[1.02] hover:border-white/50"
              style={{
                background: `linear-gradient(135deg, ${platform.color_from} 0%, ${platform.color_to} 100%)`,
              }}
            >
              <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition" />

              <div className="relative z-10 flex h-full flex-col items-center justify-center text-center">
                <p className="max-w-full truncate text-sm font-extrabold sm:text-[15px]">{platform.name}</p>
                <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-black/25 px-2 py-1 text-[10px] font-semibold sm:text-[11px]">
                  Acessar
                  <ExternalLink className="h-3.5 w-3.5" />
                </span>
              </div>
            </div>
          </a>
        ))}
      </div>

      <p className="mt-3 text-center text-xs text-slate-400">
        Jogue sempre com o valor que não irá lhe fazer falta! Deixou de ser diversão, pare imediatamente!
      </p>
    </div>
  );
}
