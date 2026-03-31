import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, DollarSign, CheckCircle2, XCircle, AlertCircle, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { resolveCurrentDepositCycle } from "@/lib/depositCycles";

function formatBrazilDate(input) {
  if (!input) return "Data indisponível";
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return "Data indisponível";
  return format(date, "dd/MM/yyyy 'as' HH:mm", { locale: ptBR });
}

function toAmount(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export default function DepositHistory({
  deposits = [],
  cycles = [],
  isLoading = false,
}) {
  const [showOlderDeposits, setShowOlderDeposits] = useState(false);

  const activeCycle = resolveCurrentDepositCycle(cycles);
  const cycleDeposits = activeCycle ? deposits.filter((deposit) => deposit.cycle_id === activeCycle.id) : [];

  const getStatusIcon = (status) => {
    if (status === "approved") return <CheckCircle2 className="w-4 h-4 text-green-400" />;
    if (status === "rejected") return <XCircle className="w-4 h-4 text-red-400" />;
    if (status === "invalidated") return <XCircle className="w-4 h-4 text-slate-400" />;
    return <AlertCircle className="w-4 h-4 text-yellow-400" />;
  };

  const getStatusBadge = (status) => {
    const styles = {
      approved: "bg-green-600/20 text-green-300 border-green-600/30",
      rejected: "bg-red-600/20 text-red-300 border-red-600/30",
      pending: "bg-yellow-600/20 text-yellow-300 border-yellow-600/30",
      invalidated: "bg-slate-700/40 text-slate-200 border-slate-600/40",
    };

    const labels = {
      approved: "Aprovado",
      rejected: "Recusado",
      pending: "Em análise",
    };

    return (
      <Badge className={`${styles[status] || styles.pending} border`}>
        {status === "invalidated" ? "Invalidado" : labels[status] || labels.pending}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-slate-900/80 to-slate-800/80 border-slate-700/50 px-3 py-4 md:px-4 md:py-5">
        <p className="text-slate-400 text-center">Carregando histórico...</p>
      </Card>
    );
  }

  if (!activeCycle) {
    return (
      <Card className="bg-gradient-to-br from-slate-900/80 to-slate-800/80 border-slate-700/50 px-3 py-4 md:px-4 md:py-5">
        <div className="text-center">
          <Clock className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-300 font-semibold">Aguardando novo ciclo</p>
          <p className="text-slate-400 text-sm mt-1">O histórico de depósitos reinicia a cada ciclo.</p>
        </div>
      </Card>
    );
  }

  if (!cycleDeposits.length) {
    return (
      <Card className="bg-gradient-to-br from-slate-900/80 to-slate-800/80 border-slate-700/50 px-3 py-4 md:px-4 md:py-5">
        <div className="text-center">
          <Clock className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">Nenhum deposito registrado neste ciclo</p>
        </div>
      </Card>
    );
  }

  const latestDeposits = cycleDeposits.slice(0, 2);
  const olderDeposits = cycleDeposits.slice(2);

  const DepositItem = ({ deposit }) => {
    const amount = toAmount(deposit.amount);
    const ticketsCount = Array.isArray(deposit.ticket_numbers) ? deposit.ticket_numbers.length : 0;
    const platformIdValue = deposit.user_platform_id || deposit.platform_id;

    return (
      <div className="w-full min-w-0 bg-slate-800/50 border border-slate-700/50 rounded-lg p-4 hover:bg-slate-800/70 transition-all">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-green-600 to-emerald-600 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">R$ {amount.toFixed(2)}</div>
              <div className="text-xs text-slate-400 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatBrazilDate(deposit.created_date)}
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            {getStatusBadge(deposit.status)}
            {getStatusIcon(deposit.status)}
          </div>
        </div>

        {deposit.platform_name ? (
          <div className="text-xs text-slate-500">
            Plataforma: <span className="text-slate-400 font-medium">{deposit.platform_name}</span>
          </div>
        ) : null}
        {platformIdValue ? (
          <div className="text-xs text-slate-500 mt-1">
            ID da plataforma: <span className="text-slate-300 font-mono font-medium">{platformIdValue}</span>
          </div>
        ) : null}

        {deposit.status === "approved" && ticketsCount > 0 ? (
          <div className="mt-2 pt-2 border-t border-slate-700/50">
            <div className="text-xs text-slate-500">
              Bilhetes gerados: <span className="text-green-400 font-bold">{ticketsCount}</span>
            </div>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <Card className="bg-gradient-to-br from-slate-900/80 to-slate-800/80 border-slate-700/50 px-3 py-4 md:px-4 md:py-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg flex items-center justify-center">
          <Clock className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-white">Histórico de Depósitos</h3>
          <p className="text-sm text-slate-400">Registros do ciclo atual #{activeCycle.cycle_number}</p>
        </div>
      </div>

      <div
        className="space-y-3 max-h-[400px] overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {latestDeposits.map((deposit) => (
          <DepositItem key={deposit.id} deposit={deposit} />
        ))}

        {olderDeposits.length > 0 ? (
          <div className="pt-2">
            <button
              onClick={() => setShowOlderDeposits((prev) => !prev)}
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-slate-700/60 bg-slate-800/40 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800/70 transition-all"
            >
              <span>
                {showOlderDeposits
                  ? "Ocultar depósitos anteriores"
                  : `Ver mais ${olderDeposits.length} depósitos`}
              </span>
              <ChevronDown className={`w-4 h-4 transition-transform ${showOlderDeposits ? "rotate-180" : ""}`} />
            </button>

            {showOlderDeposits ? (
              <div className="space-y-3 mt-3">
                {olderDeposits.map((deposit) => (
                  <DepositItem key={deposit.id} deposit={deposit} />
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
