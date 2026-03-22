import { Link } from "react-router-dom";
import { Compass, Sparkles, Stars } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DAILY_CHEST_ROUTE_PATH, FEATURE_FLAGS } from "@/lib/featureFlags";

export default function MainGameComingSoon() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.18),transparent_28%),linear-gradient(180deg,#020617_0%,#08111f_52%,#030712_100%)] px-4 py-8 text-white">
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-md items-center">
        <Card className="w-full overflow-hidden border-cyan-400/20 bg-slate-950/78 p-6 shadow-[0_30px_80px_rgba(8,145,178,0.2)] backdrop-blur-xl">
          <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500/14 text-cyan-200">
            <Compass className="h-7 w-7" />
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-200/85">Modo Principal</p>
          <h1 className="mt-3 text-3xl font-black leading-tight text-white">
            Em breve: o modo de jogo completo sera liberado
          </h1>
          <p className="mt-4 text-sm leading-6 text-slate-300">
            O mapa completo e a experiencia runner continuam preservados na base do app, mas estao temporariamente
            desativados para o lancamento inicial.
          </p>

          <div className="mt-6 grid gap-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-200">
                <Sparkles className="h-4 w-4" />
                Lancamento focado em estabilidade
              </div>
              <p className="mt-2 text-sm text-slate-400">
                Premios, perfil, depositos, feed e painel continuam operando normalmente enquanto o jogo principal
                finaliza os detalhes.
              </p>
            </div>

            {FEATURE_FLAGS.DAILY_CHEST_3D_ENABLED ? (
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/8 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-200">
                  <Stars className="h-4 w-4" />
                  Baú Diario ativo
                </div>
                <p className="mt-2 text-sm text-slate-300">
                  A experiencia separada do Bau Diario segue como trilha dedicada e sera expandida sem misturar com o
                  runner principal.
                </p>
              </div>
            ) : null}
          </div>

          <div className="mt-6 flex flex-col gap-3">
            {FEATURE_FLAGS.DAILY_CHEST_3D_ENABLED ? (
              <Button asChild className="h-12 bg-emerald-500 font-bold text-slate-950 hover:bg-emerald-400">
                <Link to={DAILY_CHEST_ROUTE_PATH}>Ir para o Bau Diario</Link>
              </Button>
            ) : null}
            <Button asChild variant="outline" className="h-12 border-slate-700 bg-slate-900/70 text-white hover:bg-slate-800">
              <Link to="/">Voltar para o app</Link>
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
