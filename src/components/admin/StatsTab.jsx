import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, Crown, Gift, Sparkles, Ticket, TriangleAlert, Trophy, Wallet } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";

const TYPE_META = {
  xp_total: { label: "XP", color: "text-cyan-300", bg: "bg-cyan-500/10" },
  weekly_points: { label: "Pontos semanais", color: "text-amber-300", bg: "bg-amber-500/10" },
  engagement_points: { label: "Pontos de engajamento", color: "text-violet-300", bg: "bg-violet-500/10" },
  tickets_active: { label: "Bilhetes", color: "text-emerald-300", bg: "bg-emerald-500/10" },
  points_balance: { label: "Banca / saldo", color: "text-pink-300", bg: "bg-pink-500/10" },
};

function getTypeMeta(type) {
  return TYPE_META[type] || { label: type || "Outro", color: "text-slate-200", bg: "bg-white/5" };
}

function formatNumber(value) {
  return new Intl.NumberFormat("pt-BR").format(Number(value || 0));
}

function buildWarnings(data) {
  const warnings = [];
  const overview = data?.overview || {};
  const chestHealth = data?.chestHealth || [];
  const weeklyConfig = data?.weeklyConfig || {};

  if (Number(overview.xpToday || 0) > 5000) {
    warnings.push("XP gerado hoje está alto. Vale revisar regras de check-in, baú e participações.");
  }

  if (Number(overview.fallbackToday || 0) > 0 && Number(overview.prizesToday || 0) > 0) {
    const fallbackRate = Number(overview.fallbackToday || 0) / Math.max(1, Number(overview.prizesToday || 0));
    if (fallbackRate >= 0.7) {
      warnings.push("O fallback do baú está sendo usado demais. Pode indicar chance baixa ou limite apertado nos melhores prêmios.");
    }
  }

  if (chestHealth.some((entry) => entry.near_limit)) {
    warnings.push("Há prêmio do baú perto do limite diário. Vale revisar cap ou peso antes de esgotar cedo.");
  }

  const positions = Array.isArray(weeklyConfig.positions) ? weeklyConfig.positions : [];
  const activePositions = positions.filter((entry) => entry.active !== false);
  if (Number(weeklyConfig.winners_count || 0) > activePositions.length) {
    warnings.push("Top semanal tem menos posições ativas do que o número de premiados configurado.");
  }

  return warnings;
}

export default function StatsTab() {
  const { data } = useQuery({
    queryKey: ["admin-gamification-overview-stats"],
    queryFn: () => base44.adminGamification.overview(),
    staleTime: 10000,
  });

  const warnings = buildWarnings(data);
  const stats = [
    { title: "XP gerado hoje", value: formatNumber(data?.overview?.xpToday), icon: Sparkles, accent: "from-cyan-400 to-sky-500" },
    { title: "Pontos semanais no ciclo", value: formatNumber(data?.overview?.weeklyPointsTotal), icon: Trophy, accent: "from-amber-300 to-orange-500" },
    { title: "Bilhetes gerados hoje", value: formatNumber(data?.overview?.ticketsToday), icon: Ticket, accent: "from-emerald-300 to-green-500" },
    { title: "Prêmios distribuídos hoje", value: formatNumber(data?.overview?.prizesToday), icon: Gift, accent: "from-pink-300 to-rose-500" },
    { title: "Uso do fallback hoje", value: formatNumber(data?.overview?.fallbackToday), icon: Activity, accent: "from-violet-300 to-fuchsia-500" },
    { title: "Usuários no sistema", value: formatNumber(data?.overview?.users), icon: Crown, accent: "from-yellow-300 to-amber-500" },
  ];

  return (
    <div className="mt-6 space-y-6">
      <Card className="border-purple-700/50 bg-gradient-to-br from-slate-900 to-indigo-950/70 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="bg-gradient-to-r from-yellow-300 to-pink-300 bg-clip-text text-2xl font-black text-transparent">
              Economia e Gamificação
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-300">
              Visão operacional do que o sistema distribuiu hoje, como o ranking está rodando e onde há risco de configuração desbalanceada.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
            <p className="font-semibold text-white">{data?.activeCycle?.title || "Sem ciclo ativo"}</p>
            <p className="mt-1 text-slate-400">Top atual: {data?.topWeekly?.[0]?.nick || "Sem dados"}.</p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.title} className="border-white/10 bg-slate-950/60 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-slate-400">{stat.title}</p>
                    <p className="mt-2 text-3xl font-black text-white">{stat.value}</p>
                  </div>
                  <div className={`rounded-2xl bg-gradient-to-br p-3 ${stat.accent}`}>
                    <Icon className="h-5 w-5 text-slate-950" />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </Card>

      {warnings.length > 0 ? (
        <Card className="border-amber-500/30 bg-amber-500/10 p-6">
          <div className="flex items-center gap-3">
            <TriangleAlert className="h-5 w-5 text-amber-300" />
            <h3 className="text-lg font-bold text-amber-100">Avisos automáticos</h3>
          </div>
          <div className="mt-4 space-y-3">
            {warnings.map((warning) => (
              <div key={warning} className="rounded-2xl border border-amber-500/20 bg-black/20 px-4 py-3 text-sm text-amber-50">
                {warning}
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-slate-800 bg-slate-900/80 p-6">
          <h3 className="text-lg font-bold text-white">Recompensas distribuídas hoje</h3>
          <p className="mt-1 text-sm text-slate-400">Resumo por tipo de prêmio validado ou entregue.</p>
          <div className="mt-4 space-y-3">
            {(data?.rewardsTodayByType || []).map((entry) => {
              const meta = getTypeMeta(entry.reward_type);
              return (
                <div key={entry.reward_type} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className={`rounded-full px-3 py-1 text-xs font-semibold ${meta.bg} ${meta.color}`}>
                      {meta.label}
                    </div>
                    <p className="text-sm text-slate-300">{formatNumber(entry.count)} entregas</p>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Volume total do tipo: {formatNumber(entry.total_amount)}
                  </p>
                </div>
              );
            })}
            {(!data?.rewardsTodayByType || data.rewardsTodayByType.length === 0) ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-400">
                Nenhuma premiação distribuída hoje ainda.
              </div>
            ) : null}
          </div>
        </Card>

        <Card className="border-slate-800 bg-slate-900/80 p-6">
          <h3 className="text-lg font-bold text-white">Top operacional</h3>
          <p className="mt-1 text-sm text-slate-400">Usuários com maior geração de valor hoje e ranking da semana.</p>

          <div className="mt-4">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Destaque do dia</p>
            <div className="mt-3 space-y-2">
              {(data?.todayTopUsers || []).map((entry, index) => (
                <div key={entry.user_id} className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                  <div>
                    <p className="font-semibold text-white">{index + 1}. {entry.nick}</p>
                    <p className="text-xs text-slate-500">pontuação combinada do dia</p>
                  </div>
                  <p className="text-sm font-bold text-cyan-300">{formatNumber(entry.score)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Ranking semanal</p>
            <div className="mt-3 space-y-2">
              {(data?.topWeekly || []).slice(0, 5).map((entry, index) => (
                <div key={`${entry.user_id}-${index}`} className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                  <div>
                    <p className="font-semibold text-white">{index + 1}. {entry.nick}</p>
                    <p className="text-xs text-slate-500">pontos semanais authoritative</p>
                  </div>
                  <p className="text-sm font-bold text-amber-300">{formatNumber(entry.weekly_points)}</p>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <Card className="border-slate-800 bg-slate-900/80 p-6">
        <h3 className="text-lg font-bold text-white">Saúde do Baú Diário</h3>
        <p className="mt-1 text-sm text-slate-400">Veja quais prêmios estão saindo mais, onde o limite está perto e quanto do pool está sendo consumido hoje.</p>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {(data?.chestHealth || []).map((entry) => {
            const meta = getTypeMeta(entry.reward_type);
            const percent = Number(entry.usage_percent || 0);
            return (
              <div key={entry.id} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">{entry.title}</p>
                    <p className="mt-1 text-sm text-slate-400">{meta.label} • {entry.reward_amount} {entry.reward_unit || ""}</p>
                  </div>
                  <div className={`rounded-full px-3 py-1 text-xs font-semibold ${meta.bg} ${meta.color}`}>
                    {entry.is_fallback ? "Fallback" : entry.rarity}
                  </div>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className={`h-full rounded-full ${entry.out_of_stock_today ? "bg-rose-500" : entry.near_limit ? "bg-amber-400" : "bg-emerald-400"}`}
                    style={{ width: `${Math.min(100, percent)}%` }}
                  />
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                  <span>Hoje: {formatNumber(entry.claimed_today)}</span>
                  <span>{entry.daily_cap ? `${percent}% do limite` : "sem limite diário"}</span>
                  <span>peso {formatNumber(entry.weight)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
