import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Ticket, Trophy, ChevronDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAppSettings } from "@/hooks/useAppSettings";

export default function TicketsDisplay({
  deposits,
  allDeposits,
  currentUserId,
  promoEndDate,
  showSummaryInCard = true,
}) {
  const [expanded, setExpanded] = useState(false);

  const { data: settings = [] } = useAppSettings();

  const { data: cycles = [] } = useQuery({
    queryKey: ["deposit-cycles-user"],
    queryFn: async () => {
      const response = await base44.deposits.dashboardSummary();
      return response.cycles || [];
    },
  });

  const depositantDrawActive = settings.find((s) => s.key === "depositant_draw_active")?.value === "true";
  const activeCycle = cycles.find((c) => c.active);

  const approvedDeposits = deposits.filter(
    (d) => d.status === "approved" && (!activeCycle || d.cycle_id === activeCycle.id)
  );
  const pendingDeposits = deposits.filter(
    (d) => d.status === "pending" && (!activeCycle || d.cycle_id === activeCycle.id)
  );

  const myTotalApproved = approvedDeposits.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
  const myPendingAmount = pendingDeposits.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
  const myBasicTickets = approvedDeposits.reduce((sum, d) => sum + Number(d.basic_ticket_count || 0), 0);
  const myBonusTickets = approvedDeposits.reduce((sum, d) => sum + Number(d.bonus_ticket_count || 0), 0);
  const myActiveTickets = approvedDeposits.reduce(
    (sum, d) => sum + Number(d.tickets_count || d.ticket_numbers?.length || 0),
    0
  );

  const allTicketNumbers = approvedDeposits.flatMap((d) => d.ticket_numbers || []);
  const displayTickets = expanded ? allTicketNumbers : allTicketNumbers.slice(0, 6);
  const hasMore = allTicketNumbers.length > 6 || (myBonusTickets > 0 && !expanded && myBonusTickets > 3);

  if (!depositantDrawActive) return null;
  if (!activeCycle) return null;

  return (
    <Card className="border-slate-800 bg-slate-900/50 p-6">
      <div className="mb-6 flex items-center gap-2">
        <Trophy className="h-6 w-6 text-cyan-400" />
        <h3 className="text-xl font-bold text-white">Confira seus bilhetes gerados</h3>
      </div>

      {showSummaryInCard ? (
        <div className="mb-4 rounded-xl border border-cyan-500/50 bg-gradient-to-r from-indigo-600/30 to-cyan-600/30 p-4 md:p-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <div className="text-center">
              <p className="mb-1 text-xs text-cyan-200 md:text-sm">Bilhetes Ativos</p>
              <p className="text-2xl font-black text-cyan-300 md:text-3xl">{myActiveTickets}</p>
            </div>
            <div className="text-center">
              <p className="mb-1 text-xs text-indigo-200 md:text-sm">Total Depositado</p>
              <p className="text-xl font-bold text-indigo-300 md:text-2xl">R$ {myTotalApproved.toFixed(2)}</p>
            </div>
            <div className="col-span-2 text-center md:col-span-1">
              <p className="mb-1 text-xs text-green-200 md:text-sm">Depósitos pendentes</p>
              <p className="text-2xl font-black text-green-300 md:text-3xl">{pendingDeposits.length}</p>
              <p className="mt-1 text-xs text-green-200">
                R$ {myPendingAmount.toFixed(2)} aguardando aprovação
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mb-4 rounded-xl border border-slate-700 bg-slate-800/50 p-4 md:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h4 className="flex items-center gap-2 text-base font-bold text-slate-200 md:text-lg">
            <Ticket className="h-5 w-5" />
            Seus Bilhetes Ativos
          </h4>
          <div className="text-right">
            <p className="text-2xl font-black text-slate-300 md:text-3xl">{myActiveTickets}</p>
            <p className="text-xs text-slate-400">
              {myBasicTickets > 0 ? `${myBasicTickets} base` : ""}
              {myBasicTickets > 0 && myBonusTickets > 0 ? " + " : ""}
              {myBonusTickets > 0 ? `${myBonusTickets} bônus` : ""}
            </p>
          </div>
        </div>

        {pendingDeposits.length > 0 ? (
          <div className="mb-4 rounded-lg border border-orange-600/50 bg-orange-900/30 p-3 text-center">
            <p className="text-sm font-bold text-orange-300">{pendingDeposits.length} depósito(s) em análise</p>
            <p className="text-xs text-orange-200">Os bilhetes só aparecem após aprovação no backend.</p>
          </div>
        ) : null}

        {myBonusTickets > 0 ? (
          <div className="mb-4 rounded-xl border border-green-500/50 bg-gradient-to-r from-green-600/30 to-emerald-600/30 p-4 md:p-5">
            <div className="flex flex-col items-center justify-between gap-3 md:flex-row">
              <div className="text-center md:text-left">
                <p className="mb-1 text-sm font-bold text-green-200 md:text-base">Bilhetes Bonus Desbloqueados!</p>
                <p className="text-xs text-green-300">Voce liberou bilhetes extras neste ciclo.</p>
                <p className="mt-1 text-xs text-green-400">Quanto mais depositos aprovados, maiores suas chances no sorteio.</p>
              </div>
              <span className="text-4xl font-black text-green-300 md:text-5xl">+{myBonusTickets}</span>
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-3 gap-2">
          {displayTickets.map((ticketNum, i) => (
            <div
              key={`approved-${i}`}
              className="group relative aspect-[3/4] overflow-hidden rounded-xl border-2 border-cyan-200 bg-gradient-to-br from-cyan-300 via-sky-300 to-indigo-400 p-1.5 text-slate-900 shadow-[0_8px_20px_rgba(56,189,248,0.35)] transition-transform hover:scale-[1.03]"
            >
              <div className="absolute left-1.5 right-1.5 top-1.5 h-4 rounded-full border border-white/60 bg-white/40" />
              <div className="relative flex h-full flex-col items-center justify-center rounded-lg border border-white/65 bg-white/30 px-1 text-center backdrop-blur-[1px]">
                <p className="text-[8px] font-extrabold uppercase tracking-[0.18em] text-slate-700">Ticket</p>
                <p className="mt-1 text-[11px] font-black tracking-wide text-slate-900">{ticketNum}</p>
              </div>
            </div>
          ))}
        </div>

        {myBonusTickets > 0 ? (
          <div className="mt-2 grid grid-cols-3 gap-2">
            {(expanded ? [...Array(myBonusTickets)] : [...Array(Math.min(3, myBonusTickets))]).map((_, i) => {
              const bonusStart = 9000000;
              const bonusNumber = (bonusStart + i).toString();
              return (
                <div
                  key={`bonus-${i}`}
                  className="group relative aspect-[3/4] overflow-hidden rounded-xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-300 via-green-300 to-lime-300 p-1.5 text-slate-900 shadow-[0_8px_20px_rgba(52,211,153,0.35)] transition-transform hover:scale-[1.03]"
                >
                  <div className="absolute left-1.5 right-1.5 top-1.5 h-4 rounded-full border border-white/60 bg-white/40" />
                  <div className="relative flex h-full flex-col items-center justify-center rounded-lg border border-white/65 bg-white/30 px-1 text-center backdrop-blur-[1px]">
                    <p className="text-[8px] font-extrabold uppercase tracking-[0.18em] text-emerald-800">Bonus</p>
                    <p className="mt-1 text-[11px] font-black tracking-wide text-slate-900">{bonusNumber}</p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        {hasMore ? (
          <Button
            onClick={() => setExpanded(!expanded)}
            className="mt-2 w-full bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-700 hover:to-cyan-700"
          >
            <ChevronDown className={`mr-2 h-5 w-5 transition-transform ${expanded ? "rotate-180" : ""}`} />
            {expanded ? "Ver Menos" : `Ver Todos (${myActiveTickets})`}
          </Button>
        ) : null}
      </div>
    </Card>
  );
}

