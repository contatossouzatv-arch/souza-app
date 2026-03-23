import React from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarDays, Crown, History, Phone, Sparkles, Trophy, UserRound } from "lucide-react";
import { base44, resolveAssetUrl } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { buildWhatsAppLink } from "@/lib/whatsapp";

function formatMoney(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(Number(value || 0));
}

function WinnerAvatar({ winner }) {
  const imageUrl = resolveAssetUrl(winner?.profile_image_url || "");
  if (imageUrl) {
    return <img src={imageUrl} alt={winner?.name || "Ganhador"} className="h-full w-full object-cover" loading="lazy" />;
  }

  return <span className="text-2xl">{winner?.avatar_emoji || "🎰"}</span>;
}

export default function WinnersHistoryBox() {
  const [selectedDay, setSelectedDay] = React.useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ["prizes-winners-history"],
    queryFn: () => base44.gamification.winnersHistory(),
    staleTime: 30000,
  });

  const days = data?.days || [];

  if (isLoading) {
    return (
      <Card className="border-slate-800 bg-slate-900/70 p-5">
        <p className="text-sm text-slate-300">Carregando historico de ganhadores...</p>
      </Card>
    );
  }

  return (
    <>
      <Card className="overflow-hidden border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/30 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-amber-300" />
              <h3 className="text-lg font-black text-white">Historico de Ganhadores</h3>
            </div>
            <p className="mt-2 max-w-xl text-sm text-slate-400">
              Cada dia mostra o historico dos sorteios. Clique e confira os ganhadores.
            </p>
          </div>
          <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-right">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-200">Dias registrados</p>
            <p className="text-xl font-black text-white">{days.length}</p>
          </div>
        </div>

        {days.length === 0 ? (
          <div className="mt-5 rounded-3xl border border-dashed border-slate-700 bg-slate-950/70 px-4 py-8 text-center">
            <Sparkles className="mx-auto h-8 w-8 text-slate-500" />
            <p className="mt-3 text-sm font-semibold text-slate-300">Nenhum sorteio realizado ainda</p>
            <p className="mt-1 text-xs text-slate-500">Quando houver vencedores validados, as datas aparecem aqui automaticamente.</p>
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {days.map((day) => (
              <motion.button
                key={day.day_key}
                whileHover={{ y: -3, scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedDay(day)}
                className="group min-w-0 overflow-hidden rounded-[1.8rem] border border-amber-400/15 bg-gradient-to-br from-amber-500/10 via-orange-500/10 to-slate-900 px-4 py-4 text-left transition hover:border-amber-300/40"
              >
                <div className="flex h-full flex-col justify-between gap-4">
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <div className="shrink-0 rounded-2xl bg-white/10 p-2 text-amber-200">
                      <CalendarDays className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 max-w-[116px] rounded-2xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-right">
                      <p className="truncate text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">Sorteios</p>
                      <p className="truncate text-sm font-black text-white">{day.total_draws || 0}</p>
                    </div>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-200/80">SORTEIO DIA</p>
                    <p className="mt-2 break-words text-lg font-black leading-tight text-white">{day.date_label}</p>
                    <p className="mt-1 break-words text-xs text-slate-400">
                      {day.total_winners || 0} ganhador{day.total_winners === 1 ? "" : "es"} confirmado{day.total_winners === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </Card>

      <Dialog open={Boolean(selectedDay)} onOpenChange={(open) => !open && setSelectedDay(null)}>
        <DialogContent className="flex max-h-[90dvh] w-[calc(100vw-0.75rem)] max-w-5xl flex-col overflow-hidden border-slate-700 bg-slate-950 px-3 text-white sm:w-[calc(100vw-2rem)] sm:px-6">
          <DialogHeader>
            <DialogTitle className="text-center text-lg font-black text-white sm:text-xl">
              Historico de {selectedDay?.date_label || "Ganhadores"}
            </DialogTitle>
            <DialogDescription className="text-center text-slate-400">
              Apenas ganhadores confirmados continuam aparecendo aqui.
            </DialogDescription>
          </DialogHeader>

          <div className="hide-scrollbar flex-1 space-y-4 overflow-y-auto pr-1">
            <AnimatePresence mode="popLayout">
              {(selectedDay?.draws || []).map((draw) => {
                const whatsappLink = buildWhatsAppLink(draw.admin_phone);
                return (
                  <motion.div
                    key={draw.draw_key}
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -18 }}
                    className="overflow-hidden rounded-[1.6rem] border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950"
                  >
                    <div className="border-b border-white/8 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-transparent px-3 py-4 sm:px-5">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-amber-100">
                              {draw.source_label}
                            </span>
                            {draw.cycle_number ? (
                              <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100">
                                Ciclo {draw.cycle_number}
                              </span>
                            ) : null}
                          </div>
                          <h4 className="mt-3 break-words text-base font-black text-white sm:text-lg">{draw.raffle_title}</h4>
                          <p className="mt-1 text-sm text-slate-400">
                            {draw.source_type === "game_call"
                              ? "Ganhadores validados na call de jogo."
                              : "Ganhadores confirmados neste sorteio."}
                          </p>
                        </div>

                        <div className="w-full rounded-3xl border border-emerald-400/20 bg-emerald-500/10 p-4 lg:max-w-[320px]">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200">ADM RESPONSAVEL</p>
                          <p className="mt-2 break-words text-base font-black text-white">{draw.admin_name || "Admin responsavel"}</p>
                          <div className="mt-3 flex items-center gap-2 text-sm text-emerald-100">
                            <Phone className="h-4 w-4 shrink-0" />
                            <span className="min-w-0 break-all">{draw.admin_phone_label || "Telefone nao informado"}</span>
                          </div>
                          <p className="mt-2 text-xs text-emerald-100/80">Chame esse contato para combinar o resgate do premio.</p>
                          {whatsappLink ? (
                            <Button
                              asChild
                              className="mt-4 w-full rounded-2xl bg-emerald-500 font-bold text-slate-950 hover:bg-emerald-400"
                            >
                              <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                                Chamar no WhatsApp
                              </a>
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">
                      {draw.winners.map((winner) => (
                        <div
                          key={winner.audit_id}
                          className="min-w-0 rounded-[1.4rem] border border-white/8 bg-white/[0.04] p-4 shadow-[0_18px_40px_rgba(0,0,0,0.18)]"
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-800">
                              <WinnerAvatar winner={winner} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-black text-white">{winner.name}</p>
                                  <p className="mt-1 truncate text-xs text-slate-400">
                                    {winner.nick ? `@${winner.nick}` : "Jogador confirmado"}
                                  </p>
                                </div>
                                <Crown className="h-4 w-4 shrink-0 text-amber-300" />
                              </div>
                              {winner.game_call ? (
                                <div className="mt-2 break-words rounded-2xl border border-fuchsia-400/20 bg-fuchsia-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-fuchsia-100">
                                  Call enviada: {winner.game_call}
                                </div>
                              ) : null}
                            </div>
                          </div>

                          <div className="mt-4 grid grid-cols-2 gap-2">
                            <div className="rounded-2xl border border-white/8 bg-slate-900/80 px-3 py-3">
                              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Premio</p>
                              <p className="mt-1 text-sm font-black text-emerald-300">{formatMoney(winner.prize_amount)}</p>
                            </div>
                            <div className="rounded-2xl border border-white/8 bg-slate-900/80 px-3 py-3">
                              <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Status</p>
                              <div className="mt-1 flex items-center gap-1.5 text-sm font-black text-amber-200">
                                <Trophy className="h-4 w-4" />
                                <span>Validado</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {selectedDay && (selectedDay.draws || []).length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-700 bg-slate-900/60 px-4 py-10 text-center">
                <UserRound className="mx-auto h-8 w-8 text-slate-500" />
                <p className="mt-3 text-sm text-slate-300">Nenhum ganhador disponivel para este dia.</p>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
