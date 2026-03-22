import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, AlertTriangle, Copy, Search, ShieldCheck, Sparkles, Ticket, Trophy, UserRound, Wallet } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/components/ui/use-toast";

const SORT_OPTIONS = [
  { value: "weekly_points", label: "Mais pontos semanais" },
  { value: "xp_total", label: "Mais XP" },
  { value: "tickets_active", label: "Mais bilhetes ativos" },
  { value: "points_balance", label: "Maior saldo / banca" },
  { value: "prize_counts", label: "Mais prêmios" },
  { value: "last_activity", label: "Atividade mais recente" },
  { value: "name", label: "Nome" },
];

const METRIC_OPTIONS = [
  { value: "xp_total", label: "XP" },
  { value: "weekly_points", label: "Pontos semanais" },
  { value: "engagement_points", label: "Pontos de engajamento" },
  { value: "tickets_active", label: "Bilhetes ativos" },
  { value: "tickets_bonus", label: "Bilhetes bônus" },
  { value: "points_balance", label: "Saldo / banca" },
];

function formatNumber(value) {
  return new Intl.NumberFormat("pt-BR").format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function selectClassName() {
  return "h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none transition focus:border-cyan-400";
}

function MetricChip({ icon: Icon, label, value, accent = "text-cyan-300" }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-500">
        <Icon className={`h-4 w-4 ${accent}`} />
        <span>{label}</span>
      </div>
      <p className="mt-2 text-xl font-black text-white">{formatNumber(value)}</p>
    </div>
  );
}

function AccessChart({ items = [] }) {
  const max = Math.max(1, ...items.map((item) => Number(item.total || 0)));
  return (
    <div className="grid grid-cols-7 gap-2">
      {items.map((item) => (
        <div key={item.label} className="flex flex-col items-center gap-2">
          <div className="flex h-24 w-full items-end rounded-2xl bg-white/5 p-2">
            <div
              className="w-full rounded-xl bg-gradient-to-t from-cyan-500 to-sky-300"
              style={{ height: `${Math.max(8, (Number(item.total || 0) / max) * 100)}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-500">{item.label}</p>
          <p className="text-xs font-semibold text-slate-200">{formatNumber(item.total)}</p>
        </div>
      ))}
    </div>
  );
}

export default function UsersAdminTab() {
  const queryClient = useQueryClient();
  const [query, setQuery] = React.useState("");
  const [sortBy, setSortBy] = React.useState("weekly_points");
  const [withPrizes, setWithPrizes] = React.useState(false);
  const [onlyAdjusted, setOnlyAdjusted] = React.useState(false);
  const [onlyAnomaly, setOnlyAnomaly] = React.useState(false);
  const [selectedUser, setSelectedUser] = React.useState(null);
  const [pendingUserAction, setPendingUserAction] = React.useState(null);
  const [adjustModalUser, setAdjustModalUser] = React.useState(null);
  const [adjustForm, setAdjustForm] = React.useState({
    metricKey: "xp_total",
    adjustment: "",
    reason: "",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users-list", query, sortBy, withPrizes, onlyAdjusted, onlyAnomaly],
    queryFn: () =>
      base44.adminUsers.list({
        q: query,
        sortBy,
        withPrizes,
        onlyAdjusted,
        onlyAnomaly,
      }),
    staleTime: 10000,
  });

  const { data: userDetail } = useQuery({
    queryKey: ["admin-user-detail", selectedUser?.id],
    queryFn: () => base44.adminUsers.detail(selectedUser.id),
    enabled: !!selectedUser?.id,
    staleTime: 10000,
  });

  const { data: userHistory } = useQuery({
    queryKey: ["admin-user-history", selectedUser?.id],
    queryFn: () => base44.adminUsers.history(selectedUser.id),
    enabled: !!selectedUser?.id,
    staleTime: 10000,
  });

  const adjustMutation = useMutation({
    mutationFn: ({ userId, payload }) => base44.adminUsers.adjustMetric(userId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users-list"] });
      queryClient.invalidateQueries({ queryKey: ["admin-user-detail"] });
      queryClient.invalidateQueries({ queryKey: ["admin-user-history"] });
      queryClient.invalidateQueries({ queryKey: ["admin-gamification-overview"] });
      setAdjustModalUser(null);
      setAdjustForm({ metricKey: "xp_total", adjustment: "", reason: "" });
      toast({ title: "Ajuste aplicado", description: "A métrica foi corrigida com rastreio administrativo." });
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Falha ao ajustar", description: error?.message || "Tente novamente." });
    },
  });

  const resetMetricsMutation = useMutation({
    mutationFn: ({ userId, payload }) => base44.adminUsers.resetMetrics(userId, payload),
    onSuccess: () => {
      setPendingUserAction(null);
      queryClient.invalidateQueries({ queryKey: ["admin-users-list"] });
      queryClient.invalidateQueries({ queryKey: ["admin-user-detail"] });
      queryClient.invalidateQueries({ queryKey: ["admin-user-history"] });
      queryClient.invalidateQueries({ queryKey: ["admin-gamification-overview"] });
      toast({ title: "Dados zerados", description: "As métricas do usuário foram zeradas com backup para restauração." });
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Falha ao zerar", description: error?.message || "Tente novamente." });
    },
  });

  const restoreMetricsMutation = useMutation({
    mutationFn: ({ userId, payload }) => base44.adminUsers.restoreLastReset(userId, payload),
    onSuccess: () => {
      setPendingUserAction(null);
      queryClient.invalidateQueries({ queryKey: ["admin-users-list"] });
      queryClient.invalidateQueries({ queryKey: ["admin-user-detail"] });
      queryClient.invalidateQueries({ queryKey: ["admin-user-history"] });
      queryClient.invalidateQueries({ queryKey: ["admin-gamification-overview"] });
      toast({ title: "Dados restaurados", description: "O último reset deste usuário foi restaurado." });
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Falha ao restaurar", description: error?.message || "Tente novamente." });
    },
  });

  function handleCopy(text, label = "Resumo copiado") {
    navigator.clipboard.writeText(text || "").then(() => {
      toast({ title: label, description: "As informações foram copiadas para a área de transferência." });
    });
  }

  function openAdjust(user) {
    setAdjustModalUser(user);
    setAdjustForm({ metricKey: "xp_total", adjustment: "", reason: "" });
  }

  function handleResetUserMetrics(user) {
    if (!user?.id) return;
    if (!window.confirm(`Preparar zeramento de ${user.full_name || "este usuário"}?\n\nDepois clique em salvar para aplicar de verdade.`)) {
      return;
    }
    setPendingUserAction({
      type: "reset",
      userId: user.id,
      reason: "Reset administrativo manual pelo painel de usuários",
      userName: user.full_name || "este usuário",
    });
  }

  function handleRestoreUserMetrics(user) {
    if (!user?.id) return;
    if (!window.confirm(`Preparar restauração de ${user.full_name || "este usuário"}?\n\nDepois clique em salvar para aplicar de verdade.`)) {
      return;
    }
    setPendingUserAction({
      type: "restore",
      userId: user.id,
      reason: "Restauração administrativa manual pelo painel de usuários",
      userName: user.full_name || "este usuário",
    });
  }

  function applyPendingUserAction() {
    if (!pendingUserAction?.userId) return;
    if (pendingUserAction.type === "reset") {
      resetMetricsMutation.mutate({
        userId: pendingUserAction.userId,
        payload: {
          reason: pendingUserAction.reason,
          clearDisplayData: true,
        },
      });
      return;
    }
    restoreMetricsMutation.mutate({
      userId: pendingUserAction.userId,
      payload: {
        reason: pendingUserAction.reason,
      },
    });
  }

  const items = data?.items || [];
  const recentAdjustments = data?.recentAdjustments || [];
  const dashboard = data?.dashboard || {};

  return (
    <div className="mt-6 space-y-6">
      <Card className="border-indigo-700/40 bg-gradient-to-br from-slate-900/85 to-indigo-950/50 p-6">
        <h2 className="text-2xl font-black text-white">Gestão de Usuários</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-300">
          Consulte cada usuário com métricas consolidadas e faça ajustes manuais seguros quando houver suporte, correção operacional ou necessidade de conciliação.
        </p>
      </Card>

      <Card className="border-slate-800 bg-slate-900/80 p-6">
        <div className="mb-5 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="grid gap-4 md:grid-cols-3">
            <MetricChip icon={Activity} label="Usuários online" value={dashboard.online_now} accent="text-emerald-300" />
            <MetricChip icon={UserRound} label="Acessos do dia" value={dashboard.accesses_today} accent="text-cyan-300" />
            <MetricChip icon={ShieldCheck} label="Acessos do mês" value={dashboard.accesses_month} accent="text-violet-300" />
          </div>
          <Card className="border-slate-800 bg-slate-950/60 p-4">
            <div className="mb-3">
              <h3 className="font-bold text-white">Tendência de acessos</h3>
              <p className="text-sm text-slate-400">Últimos 7 dias de login bem-sucedido registrados no backend.</p>
            </div>
            <AccessChart items={dashboard.chart || []} />
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr_0.7fr_0.7fr]">
          <div className="space-y-2">
            <Label className="text-slate-200">Buscar usuário</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nome, @username, email, telefone ou ID" className="border-slate-700 bg-slate-950 pl-10 text-white" />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-slate-200">Ordenar por</Label>
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} className={selectClassName()}>
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label className="text-slate-200">Filtros rápidos</Label>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant={withPrizes ? "default" : "outline"} onClick={() => setWithPrizes((prev) => !prev)} className={withPrizes ? "bg-emerald-500 text-slate-950 hover:bg-emerald-400" : "border-slate-700 bg-slate-950 text-white"}>
                Com prêmios
              </Button>
              <Button type="button" variant={onlyAdjusted ? "default" : "outline"} onClick={() => setOnlyAdjusted((prev) => !prev)} className={onlyAdjusted ? "bg-cyan-500 text-slate-950 hover:bg-cyan-400" : "border-slate-700 bg-slate-950 text-white"}>
                Com ajuste
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-slate-200">Proteção</Label>
            <Button type="button" variant={onlyAnomaly ? "default" : "outline"} onClick={() => setOnlyAnomaly((prev) => !prev)} className={`w-full ${onlyAnomaly ? "bg-amber-400 text-slate-950 hover:bg-amber-300" : "border-slate-700 bg-slate-950 text-white"}`}>
              Somente usuários com anomalia
            </Button>
          </div>
        </div>
      </Card>

      <Card className="border-slate-800 bg-slate-900/80 p-4 md:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-white">Usuários consolidados</h3>
            <p className="text-sm text-slate-400">Lista authoritative com métricas atuais, ranking e sinais operacionais.</p>
          </div>
          <Badge className="bg-white/10 text-slate-100">{formatNumber(items.length)} usuários</Badge>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800">
                <TableHead className="text-slate-300">Usuário</TableHead>
                <TableHead className="text-slate-300">Nível</TableHead>
                <TableHead className="text-slate-300">XP</TableHead>
                <TableHead className="text-slate-300">Semana</TableHead>
                <TableHead className="text-slate-300">Bilhetes</TableHead>
                <TableHead className="text-slate-300">Saldo</TableHead>
                <TableHead className="text-slate-300">Prêmios</TableHead>
                <TableHead className="text-slate-300">Ranking</TableHead>
                <TableHead className="text-slate-300">Status</TableHead>
                <TableHead className="text-slate-300 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((user) => (
                <TableRow key={user.id} className="border-slate-800">
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-white">{user.full_name || "Sem nome"}</p>
                        {user.had_manual_adjustment ? <Badge className="bg-cyan-500/20 text-cyan-200">teve ajuste manual</Badge> : null}
                        {user.has_anomaly ? <Badge className="bg-amber-500/20 text-amber-100">anomalia</Badge> : null}
                      </div>
                      <p className="text-xs text-slate-400">@{user.nick || "-"} • {user.email || "-"}</p>
                      <p className="text-xs text-slate-500">{user.phone || "Sem telefone"} • {user.id}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-white">{user.level}</TableCell>
                  <TableCell className="text-white">{formatNumber(user.xp_total)}</TableCell>
                  <TableCell className="text-white">{formatNumber(user.weekly_points)}</TableCell>
                  <TableCell className="text-white">
                    {formatNumber(user.tickets_active)}
                    {Number(user.tickets_bonus || 0) > 0 ? <span className="block text-xs text-slate-500">+{formatNumber(user.tickets_bonus)} bônus</span> : null}
                  </TableCell>
                  <TableCell className="text-white">{formatNumber(user.points_balance)}</TableCell>
                  <TableCell className="text-white">{formatNumber(user.prize_counts)}</TableCell>
                  <TableCell className="text-white">{user.ranking_position || "-"}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <Badge className={user.status === "active" ? "bg-emerald-600" : "bg-slate-700"}>{user.status}</Badge>
                      <p className="text-xs text-slate-500">{formatDate(user.last_activity_at)}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => handleCopy(user.summary_text)} className="border-slate-700 bg-slate-950 text-white">
                        <Copy className="mr-2 h-4 w-4" />
                        Resumo
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => setSelectedUser(user)} className="border-slate-700 bg-slate-950 text-white">
                        Detalhes
                      </Button>
                      <Button type="button" size="sm" onClick={() => openAdjust(user)} className="bg-cyan-500 text-slate-950 hover:bg-cyan-400">
                        Ajustar
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && items.length === 0 ? (
                <TableRow className="border-slate-800">
                  <TableCell colSpan={10} className="py-10 text-center text-slate-400">
                    Nenhum usuário encontrado com os filtros atuais.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Card className="border-slate-800 bg-slate-900/80 p-6">
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-cyan-300" />
          <h3 className="text-lg font-bold text-white">Últimos 20 ajustes feitos por admins</h3>
        </div>
        <div className="space-y-3">
          {recentAdjustments.map((entry) => (
            <div key={entry.id} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-white">{entry.metadata?.metric_key || "Métrica"} • usuário {entry.metadata?.user_id || entry.target_key}</p>
                  <p className="mt-1 text-sm text-slate-400">
                    {entry.admin_email || "admin"} ajustou {formatNumber(entry.metadata?.adjustment || 0)} por motivo: {entry.metadata?.reason || "-"}
                  </p>
                </div>
                <p className="text-xs text-slate-500">{formatDate(entry.created_at)}</p>
              </div>
            </div>
          ))}
          {recentAdjustments.length === 0 ? <p className="text-sm text-slate-400">Nenhum ajuste manual recente.</p> : null}
        </div>
      </Card>

      <Dialog open={Boolean(selectedUser)} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <DialogContent className="max-h-[88vh] max-w-5xl overflow-y-auto border-slate-800 bg-[#09090f] text-white">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-3 text-2xl font-black">
              <UserRound className="h-6 w-6 text-cyan-300" />
              {userDetail?.user?.full_name || selectedUser?.full_name || "Usuário"}
              {userDetail?.user?.had_manual_adjustment ? <Badge className="bg-cyan-500/20 text-cyan-200">teve ajuste manual</Badge> : null}
            </DialogTitle>
          </DialogHeader>

          {userDetail?.user ? (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-800 bg-slate-950/70 p-4">
                <div>
                  <p className="text-sm text-slate-400">@{userDetail.user.nick || "-"}</p>
                  <p className="mt-1 text-sm text-slate-400">{userDetail.user.email || "-"} • {userDetail.user.phone || "Sem telefone"}</p>
                  <p className="mt-1 text-xs text-slate-500">{userDetail.user.id}</p>
                </div>
                <div className="flex gap-2">
                  {pendingUserAction?.userId === userDetail.user.id ? (
                    <Button
                      type="button"
                      onClick={applyPendingUserAction}
                      disabled={resetMetricsMutation.isPending || restoreMetricsMutation.isPending}
                      className="bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                    >
                      {resetMetricsMutation.isPending || restoreMetricsMutation.isPending ? "Salvando..." : "Salvar ações"}
                    </Button>
                  ) : null}
                  <Button type="button" variant="outline" onClick={() => handleCopy(userDetail.user.summary_text, "Resumo do usuário copiado")} className="border-slate-700 bg-slate-950 text-white">
                    <Copy className="mr-2 h-4 w-4" />
                    Copiar resumo do usuário
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleRestoreUserMetrics(userDetail.user)}
                    disabled={restoreMetricsMutation.isPending || resetMetricsMutation.isPending}
                    className="border-emerald-700 bg-emerald-950/40 text-emerald-100 hover:bg-emerald-900/60"
                  >
                    {restoreMetricsMutation.isPending ? "Restaurando..." : "Recuperar dados"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleResetUserMetrics(userDetail.user)}
                    disabled={resetMetricsMutation.isPending || restoreMetricsMutation.isPending}
                    className="border-amber-700 bg-amber-950/40 text-amber-100 hover:bg-amber-900/60"
                  >
                    {resetMetricsMutation.isPending ? "Zerando..." : "Zerar dados"}
                  </Button>
                  <Button type="button" onClick={() => openAdjust(userDetail.user)} className="bg-cyan-500 text-slate-950 hover:bg-cyan-400">
                    Ajustar métrica
                  </Button>
                </div>
              </div>

              {pendingUserAction?.userId === userDetail.user.id ? (
                <Card className="border-amber-500/30 bg-amber-500/10 p-4">
                  <p className="font-semibold text-amber-100">Ação pendente</p>
                  <p className="mt-1 text-sm text-amber-50">
                    {pendingUserAction.type === "reset" ? "Zeramento" : "Restauração"} preparado para {pendingUserAction.userName}. Clique em <strong>Salvar ações</strong> para aplicar.
                  </p>
                </Card>
              ) : null}

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <MetricChip icon={Sparkles} label="XP total" value={userDetail.user.xp_total} accent="text-cyan-300" />
                <MetricChip icon={Trophy} label="Pontos semanais" value={userDetail.user.weekly_points} accent="text-amber-300" />
                <MetricChip icon={Ticket} label="Bilhetes ativos" value={userDetail.user.tickets_active} accent="text-emerald-300" />
                <MetricChip icon={Wallet} label="Saldo / banca" value={userDetail.user.points_balance} accent="text-pink-300" />
              </div>

              {userDetail.user.has_anomaly ? (
                <Card className="border-amber-500/30 bg-amber-500/10 p-4">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-200" />
                    <p className="font-semibold text-amber-100">Sinais de anomalia</p>
                  </div>
                  <div className="mt-3 space-y-2">
                    {userDetail.user.anomaly_reasons.map((reason) => (
                      <p key={reason} className="text-sm text-amber-50">{reason}</p>
                    ))}
                  </div>
                </Card>
              ) : null}

              <div className="grid gap-4 xl:grid-cols-2">
                <Card className="border-slate-800 bg-slate-950/70 p-4">
                  <h4 className="font-bold text-white">Métricas e posição atual</h4>
                  <div className="mt-3 grid gap-2 text-sm text-slate-300">
                    <p>Data de cadastro: {formatDate(userDetail.user.created_at)}</p>
                    <p>Quantidade de acessos ao app: {formatNumber(userDetail.user.login_count)}</p>
                    <p>Nível: {userDetail.user.level}</p>
                    <p>Pontos de engajamento: {formatNumber(userDetail.user.engagement_points)}</p>
                    <p>Bilhetes bônus: {formatNumber(userDetail.user.tickets_bonus)}</p>
                    <p>Total de prêmios: {formatNumber(userDetail.user.prize_counts)}</p>
                    <p>Posição no ciclo semanal: {userDetail.user.ranking_position || "-"}</p>
                    <p>Última atividade: {formatDate(userDetail.user.last_activity_at)}</p>
                  </div>
                </Card>

                <Card className="border-slate-800 bg-slate-950/70 p-4">
                  <h4 className="font-bold text-white">Histórico resumido</h4>
                  <div className="mt-3 grid gap-2 text-sm text-slate-300">
                    <p>Depósitos recentes: {formatNumber(userHistory?.deposits?.length || 0)}</p>
                    <p>Baús recentes: {formatNumber(userHistory?.chestOpenings?.length || 0)}</p>
                    <p>Participações recentes: {formatNumber(userHistory?.participations?.length || 0)}</p>
                    <p>Claims / premiações: {formatNumber(userHistory?.prizes?.length || 0)}</p>
                    <p>Cashback claims: {formatNumber(userHistory?.cashbackClaims?.length || 0)}</p>
                    <p>Ajustes administrativos: {formatNumber(userHistory?.adjustments?.length || 0)}</p>
                  </div>
                </Card>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <Card className="border-slate-800 bg-slate-950/70 p-4">
                  <h4 className="font-bold text-white">IPs e acessos</h4>
                  <div className="mt-3 space-y-3">
                    {(userDetail.user.ips || []).map((entry) => (
                      <div key={`${entry.ip}-${entry.last_seen || ""}`} className="rounded-2xl border border-slate-800 bg-black/20 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold text-white">{entry.ip || "IP não registrado"}</p>
                          <p className="text-xs text-slate-500">último acesso: {formatDate(entry.last_seen)}</p>
                        </div>
                        <p className="mt-1 text-sm text-slate-400">{formatNumber(entry.hits)} login(s) bem-sucedido(s)</p>
                        {entry.shared_accounts_count > 0 ? (
                          <div className="mt-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-50">
                            Mesmo IP apareceu em {entry.shared_accounts_count} outra(s) conta(s): {entry.shared_accounts.join(", ")}
                          </div>
                        ) : null}
                      </div>
                    ))}
                    {(!userDetail.user.ips || userDetail.user.ips.length === 0) ? (
                      <p className="text-sm text-slate-400">Nenhum IP de login bem-sucedido registrado para este usuário.</p>
                    ) : null}
                  </div>
                </Card>

                <Card className="border-slate-800 bg-slate-950/70 p-4">
                  <h4 className="font-bold text-white">Premiações e baú</h4>
                  <div className="mt-3 space-y-3">
                    {(userHistory?.prizes || []).slice(0, 8).map((entry) => (
                      <div key={entry.id} className="rounded-2xl border border-slate-800 bg-black/20 p-3">
                        <p className="font-semibold text-white">{entry.title || "Prêmio"}</p>
                        <p className="text-sm text-slate-400">{entry.reward_type} • {entry.reward_amount} {entry.reward_unit || ""}</p>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card className="border-slate-800 bg-slate-950/70 p-4">
                  <h4 className="font-bold text-white">Últimos ajustes administrativos</h4>
                  <div className="mt-3 space-y-3">
                    {(userHistory?.adjustments || []).slice(0, 8).map((entry) => (
                      <div key={entry.id} className="rounded-2xl border border-slate-800 bg-black/20 p-3">
                        <p className="font-semibold text-white">{entry.metadata?.metric_key || "Métrica"} • {formatDate(entry.created_at)}</p>
                        <p className="text-sm text-slate-400">{entry.metadata?.reason || "-"}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(adjustModalUser)} onOpenChange={(open) => !open && setAdjustModalUser(null)}>
        <DialogContent className="border-slate-800 bg-[#09090f] text-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">Ajuste manual seguro</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-300">
              Esse ajuste não altera o total silenciosamente. Ele vira evento administrativo auditável e reflete no consolidado do usuário.
            </div>
            <div className="space-y-2">
              <Label className="text-slate-200">Métrica</Label>
              <select value={adjustForm.metricKey} onChange={(event) => setAdjustForm((prev) => ({ ...prev, metricKey: event.target.value }))} className={selectClassName()}>
                {METRIC_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-200">Ajuste aplicado</Label>
              <Input value={adjustForm.adjustment} onChange={(event) => setAdjustForm((prev) => ({ ...prev, adjustment: event.target.value }))} placeholder="Use número positivo ou negativo" className="border-slate-700 bg-slate-950 text-white" />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-200">Motivo obrigatório</Label>
              <Textarea value={adjustForm.reason} onChange={(event) => setAdjustForm((prev) => ({ ...prev, reason: event.target.value }))} rows={4} className="border-slate-700 bg-slate-950 text-white" />
            </div>
            <Button
              type="button"
              onClick={() =>
                adjustMutation.mutate({
                  userId: adjustModalUser.id,
                  payload: {
                    metricKey: adjustForm.metricKey,
                    adjustment: Number(adjustForm.adjustment || 0),
                    reason: adjustForm.reason,
                  },
                })
              }
              disabled={adjustMutation.isPending}
              className="w-full bg-cyan-500 font-bold text-slate-950 hover:bg-cyan-400"
            >
              {adjustMutation.isPending ? "Aplicando..." : "Aplicar ajuste"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
