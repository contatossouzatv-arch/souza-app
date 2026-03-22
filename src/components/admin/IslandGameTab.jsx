import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";

const CONFIG_FIELDS = [
  { key: "speed_start", label: "Velocidade Inicial", placeholder: "0.64" },
  { key: "speed_cap", label: "Velocidade Máxima", placeholder: "2.3" },
  { key: "speed_ramp_ms", label: "Ramp-up (ms)", placeholder: "65000" },
  { key: "block_spawn_min_ms", label: "Bloco Spawn Mín (ms)", placeholder: "130" },
  { key: "block_spawn_max_ms", label: "Bloco Spawn Máx (ms)", placeholder: "600" },
  { key: "obstacle_spawn_min_ms", label: "Obstáculo Spawn Mín (ms)", placeholder: "760" },
  { key: "obstacle_spawn_max_ms", label: "Obstáculo Spawn Máx (ms)", placeholder: "1600" },
  { key: "chest_base", label: "Chance Base Baú", placeholder: "5" },
  { key: "chest_gain_daily", label: "Ganho Coleta (Diária)", placeholder: "1.9" },
  { key: "chest_gain_regular", label: "Ganho Coleta (Normal)", placeholder: "1.4" },
];

const DEFAULT_THEME = {
  sky_top: "#0f172a",
  sky_glow: "rgba(56,189,248,0.22)",
  road_from: "rgba(71,85,105,0.7)",
  road_to: "rgba(15,23,42,0.9)",
  player: "rgba(103,232,249,0.92)",
  block: "rgba(52,211,153,0.88)",
  obstacle: "rgba(244,63,94,0.78)",
};
const THEME_PRESETS = [
  { island_day: 1, sky_top: "#0f172a", sky_glow: "rgba(56,189,248,0.24)", road_from: "rgba(71,85,105,0.7)", road_to: "rgba(15,23,42,0.9)", player: "rgba(103,232,249,0.92)", block: "rgba(52,211,153,0.88)", obstacle: "rgba(244,63,94,0.78)" },
  { island_day: 2, sky_top: "#102a43", sky_glow: "rgba(125,211,252,0.24)", road_from: "rgba(59,130,246,0.48)", road_to: "rgba(30,41,59,0.9)", player: "rgba(59,130,246,0.9)", block: "rgba(16,185,129,0.9)", obstacle: "rgba(239,68,68,0.78)" },
  { island_day: 3, sky_top: "#1e1b4b", sky_glow: "rgba(167,139,250,0.24)", road_from: "rgba(99,102,241,0.5)", road_to: "rgba(30,27,75,0.92)", player: "rgba(129,140,248,0.92)", block: "rgba(34,197,94,0.88)", obstacle: "rgba(244,114,182,0.78)" },
  { island_day: 4, sky_top: "#052e2b", sky_glow: "rgba(45,212,191,0.24)", road_from: "rgba(20,184,166,0.46)", road_to: "rgba(6,78,59,0.92)", player: "rgba(45,212,191,0.92)", block: "rgba(16,185,129,0.9)", obstacle: "rgba(239,68,68,0.8)" },
  { island_day: 5, sky_top: "#3f1d2e", sky_glow: "rgba(251,113,133,0.24)", road_from: "rgba(236,72,153,0.46)", road_to: "rgba(76,5,25,0.92)", player: "rgba(244,114,182,0.92)", block: "rgba(52,211,153,0.88)", obstacle: "rgba(251,146,60,0.8)" },
  { island_day: 6, sky_top: "#3f2a0d", sky_glow: "rgba(251,191,36,0.24)", road_from: "rgba(234,179,8,0.42)", road_to: "rgba(120,53,15,0.92)", player: "rgba(250,204,21,0.92)", block: "rgba(74,222,128,0.9)", obstacle: "rgba(239,68,68,0.78)" },
  { island_day: 7, sky_top: "#1f2937", sky_glow: "rgba(148,163,184,0.24)", road_from: "rgba(100,116,139,0.46)", road_to: "rgba(15,23,42,0.94)", player: "rgba(226,232,240,0.92)", block: "rgba(16,185,129,0.9)", obstacle: "rgba(248,113,113,0.8)" },
];

const THEME_FIELDS = [
  { key: "sky_top", label: "Céu (fundo)" },
  { key: "sky_glow", label: "Brilho céu" },
  { key: "road_from", label: "Rua início" },
  { key: "road_to", label: "Rua fim" },
  { key: "player", label: "Cor jogador" },
  { key: "block", label: "Cor bloco dinheiro" },
  { key: "obstacle", label: "Cor obstáculo" },
];

const ISLAND_DAYS = [1, 2, 3, 4, 5, 6, 7];

function toNumberOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export default function IslandGameTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const [configDraft, setConfigDraft] = React.useState({});
  const [selectedDay, setSelectedDay] = React.useState(1);
  const [themeDraft, setThemeDraft] = React.useState(DEFAULT_THEME);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [dayFilter, setDayFilter] = React.useState("all");
  const [creditForm, setCreditForm] = React.useState({
    userId: "",
    amount: "",
    reason: "",
    sessionId: "",
  });

  const { data: configs = [] } = useQuery({
    queryKey: ["island-game-admin-configs"],
    queryFn: () => base44.entities.IslandGameConfig.list(),
  });
  const { data: themes = [] } = useQuery({
    queryKey: ["island-game-admin-themes"],
    queryFn: () => base44.entities.IslandGameTheme.list(),
  });
  const { data: sessions = [] } = useQuery({
    queryKey: ["island-game-admin-sessions"],
    queryFn: () => base44.entities.IslandGameSession.list("-created_date", 400),
  });
  const { data: users = [] } = useQuery({
    queryKey: ["island-game-admin-users"],
    queryFn: () => base44.entities.User.list(),
    staleTime: 60_000,
  });

  React.useEffect(() => {
    const next = {};
    CONFIG_FIELDS.forEach((field) => {
      const found = configs.find((item) => item.key === field.key);
      next[field.key] = found?.value != null ? String(found.value) : "";
    });
    setConfigDraft(next);
  }, [configs]);

  React.useEffect(() => {
    const found = themes.find((item) => Number(item.island_day) === Number(selectedDay));
    setThemeDraft({
      sky_top: String(found?.sky_top || DEFAULT_THEME.sky_top),
      sky_glow: String(found?.sky_glow || DEFAULT_THEME.sky_glow),
      road_from: String(found?.road_from || DEFAULT_THEME.road_from),
      road_to: String(found?.road_to || DEFAULT_THEME.road_to),
      player: String(found?.player || DEFAULT_THEME.player),
      block: String(found?.block || DEFAULT_THEME.block),
      obstacle: String(found?.obstacle || DEFAULT_THEME.obstacle),
    });
  }, [selectedDay, themes]);

  const saveConfigMutation = useMutation({
    mutationFn: async () => {
      for (const field of CONFIG_FIELDS) {
        const existing = configs.find((item) => item.key === field.key);
        const parsed = toNumberOrNull(configDraft[field.key]);
        if (parsed === null) continue;
        if (existing) {
          await base44.entities.IslandGameConfig.update(existing.id, { value: parsed });
        } else {
          await base44.entities.IslandGameConfig.create({
            key: field.key,
            value: parsed,
            section: "runner",
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["island-game-admin-configs"] });
      toast({
        title: "Configuração salva",
        description: "Parâmetros do runner atualizados com sucesso.",
      });
    },
  });

  const saveThemeMutation = useMutation({
    mutationFn: async () => {
      const existing = themes.find((item) => Number(item.island_day) === Number(selectedDay));
      const payload = {
        island_day: Number(selectedDay),
        ...themeDraft,
      };
      if (existing) {
        await base44.entities.IslandGameTheme.update(existing.id, payload);
      } else {
        await base44.entities.IslandGameTheme.create(payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["island-game-admin-themes"] });
      toast({
        title: "Tema salvo",
        description: `Tema da Ilha ${selectedDay} atualizado.`,
      });
    },
  });

  const seedDefaultsMutation = useMutation({
    mutationFn: async () => {
      const defaultsByKey = {
        speed_start: 0.64,
        speed_cap: 2.3,
        speed_ramp_ms: 65000,
        block_spawn_min_ms: 130,
        block_spawn_max_ms: 600,
        obstacle_spawn_min_ms: 760,
        obstacle_spawn_max_ms: 1600,
        chest_base: 5,
        chest_gain_daily: 1.9,
        chest_gain_regular: 1.4,
      };

      for (const field of CONFIG_FIELDS) {
        const existing = configs.find((item) => item.key === field.key);
        if (existing) continue;
        await base44.entities.IslandGameConfig.create({
          key: field.key,
          value: defaultsByKey[field.key],
          section: "runner",
          seeded: true,
        });
      }

      for (const preset of THEME_PRESETS) {
        const existing = themes.find((item) => Number(item.island_day) === Number(preset.island_day));
        if (existing) continue;
        await base44.entities.IslandGameTheme.create({
          ...preset,
          seeded: true,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["island-game-admin-configs"] });
      queryClient.invalidateQueries({ queryKey: ["island-game-admin-themes"] });
      toast({
        title: "Seed aplicado",
        description: "Configuração inicial do runner e temas das 7 ilhas foi criada.",
      });
    },
  });

  const markSessionMutation = useMutation({
    mutationFn: ({ sessionId, patch }) => base44.entities.IslandGameSession.update(sessionId, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["island-game-admin-sessions"] });
    },
  });

  const creditMutation = useMutation({
    mutationFn: async () => {
      const amount = Number(creditForm.amount);
      if (!creditForm.userId || !Number.isInteger(amount) || amount === 0 || !creditForm.reason.trim()) {
        throw new Error("Preencha user, amount (inteiro != 0) e motivo.");
      }
      const requestId = `island-admin-${Date.now()}-${creditForm.userId}`;
      await base44.points.award({
        userId: creditForm.userId,
        amount,
        reason: creditForm.reason.trim(),
        requestId,
        metadata: {
          source: "island_game_admin",
          admin_user_id: user?.id || "",
          session_id: creditForm.sessionId || null,
        },
      });

      if (creditForm.sessionId) {
        const targetSession = sessions.find((item) => item.id === creditForm.sessionId);
        const previous = Number(targetSession?.admin_credit_amount || 0);
        await base44.entities.IslandGameSession.update(creditForm.sessionId, {
          admin_credit_amount: previous + amount,
          admin_credit_reason: creditForm.reason.trim(),
          admin_credit_by: user?.id || "admin",
          admin_credit_date: new Date().toISOString(),
          status: "credited",
        });
      }
    },
    onSuccess: () => {
      setCreditForm({ userId: "", amount: "", reason: "", sessionId: "" });
      queryClient.invalidateQueries({ queryKey: ["island-game-admin-sessions"] });
      toast({
        title: "Crédito aplicado",
        description: "Ajuste manual registrado com sucesso.",
      });
    },
  });

  const usersById = React.useMemo(() => {
    const map = new Map();
    users.forEach((entry) => map.set(entry.id, entry));
    return map;
  }, [users]);

  const filteredSessions = React.useMemo(() => {
    return sessions.filter((entry) => {
      const day = String(entry.island_day || "");
      const status = String(entry.status || "").toLowerCase();
      const userName = String(entry.user_name || "").toLowerCase();
      const userNick = String(entry.user_nick || "").toLowerCase();
      const isMatchDay = dayFilter === "all" || dayFilter === day;
      const isMatchStatus = statusFilter === "all" || status === statusFilter;
      const isMatchSearch =
        !search ||
        userName.includes(search.toLowerCase()) ||
        userNick.includes(search.toLowerCase()) ||
        String(entry.user_id || "").toLowerCase().includes(search.toLowerCase()) ||
        String(entry.id || "").toLowerCase().includes(search.toLowerCase());
      return isMatchDay && isMatchStatus && isMatchSearch;
    });
  }, [dayFilter, search, sessions, statusFilter]);

  return (
    <div className="mt-6 space-y-6">
      <Card className="border-cyan-700/50 bg-gradient-to-br from-slate-900/70 to-cyan-950/50 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="bg-gradient-to-r from-cyan-300 to-emerald-300 bg-clip-text text-2xl font-bold text-transparent">
              Jogo Ilhas - Controle Completo
            </h2>
            <p className="mt-1 text-sm text-cyan-100/90">
              Sessões separadas para configuração, tema, auditoria e crédito manual.
            </p>
          </div>
          <Button
            className="bg-cyan-600 hover:bg-cyan-700"
            disabled={seedDefaultsMutation.isPending}
            onClick={() => seedDefaultsMutation.mutate()}
          >
            {seedDefaultsMutation.isPending ? "Aplicando seed..." : "Aplicar Setup Inicial"}
          </Button>
        </div>
      </Card>

      <Tabs defaultValue="config" className="w-full">
        <TabsList className="flex h-auto w-full flex-wrap gap-2 bg-slate-900/70 p-2">
          <TabsTrigger value="config" className="data-[state=active]:bg-cyan-700">
            Config Runner
          </TabsTrigger>
          <TabsTrigger value="themes" className="data-[state=active]:bg-emerald-700">
            Temas por Ilha
          </TabsTrigger>
          <TabsTrigger value="sessions" className="data-[state=active]:bg-blue-700">
            Sessões e Auditoria
          </TabsTrigger>
          <TabsTrigger value="credit" className="data-[state=active]:bg-amber-700">
            Crédito Manual
          </TabsTrigger>
        </TabsList>

        <TabsContent value="config">
          <Card className="border-cyan-700/50 bg-slate-900/70 p-6">
            <h3 className="mb-4 text-lg font-bold text-cyan-200">Parâmetros do Mini-game Runner</h3>
            <div className="grid gap-4 md:grid-cols-2">
              {CONFIG_FIELDS.map((field) => (
                <div key={field.key} className="space-y-1">
                  <Label className="text-cyan-100">{field.label}</Label>
                  <Input
                    value={configDraft[field.key] || ""}
                    placeholder={field.placeholder}
                    onChange={(event) =>
                      setConfigDraft((prev) => ({
                        ...prev,
                        [field.key]: event.target.value,
                      }))
                    }
                    className="border-slate-700 bg-slate-950/70 text-white"
                  />
                </div>
              ))}
            </div>
            <Button
              className="mt-6 bg-cyan-600 hover:bg-cyan-700"
              disabled={saveConfigMutation.isPending}
              onClick={() => saveConfigMutation.mutate()}
            >
              {saveConfigMutation.isPending ? "Salvando..." : "Salvar Configuração"}
            </Button>
          </Card>
        </TabsContent>

        <TabsContent value="themes">
          <Card className="border-emerald-700/50 bg-slate-900/70 p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-bold text-emerald-200">Tema Visual Padrão por Ilha</h3>
              <select
                value={selectedDay}
                onChange={(event) => setSelectedDay(Number(event.target.value))}
                className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              >
                {ISLAND_DAYS.map((day) => (
                  <option key={day} value={day}>
                    Ilha {day}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {THEME_FIELDS.map((field) => (
                <div key={field.key} className="space-y-1">
                  <Label className="text-emerald-100">{field.label}</Label>
                  <Input
                    value={themeDraft[field.key] || ""}
                    onChange={(event) =>
                      setThemeDraft((prev) => ({
                        ...prev,
                        [field.key]: event.target.value,
                      }))
                    }
                    className="border-slate-700 bg-slate-950/70 text-white"
                  />
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-xl border border-slate-700 bg-slate-950/60 p-4">
              <p className="mb-2 text-xs uppercase tracking-[0.14em] text-slate-300">Prévia de cores</p>
              <div className="flex items-center gap-3">
                <div className="h-7 w-7 rounded border border-slate-600" style={{ background: themeDraft.sky_top }} />
                <div className="h-7 w-7 rounded border border-slate-600" style={{ background: themeDraft.road_to }} />
                <div className="h-7 w-7 rounded border border-slate-600" style={{ background: themeDraft.player }} />
                <div className="h-7 w-7 rounded border border-slate-600" style={{ background: themeDraft.block }} />
                <div className="h-7 w-7 rounded border border-slate-600" style={{ background: themeDraft.obstacle }} />
              </div>
            </div>

            <Button
              className="mt-6 bg-emerald-600 hover:bg-emerald-700"
              disabled={saveThemeMutation.isPending}
              onClick={() => saveThemeMutation.mutate()}
            >
              {saveThemeMutation.isPending ? "Salvando..." : "Salvar Tema da Ilha"}
            </Button>
          </Card>
        </TabsContent>

        <TabsContent value="sessions">
          <Card className="border-blue-700/50 bg-slate-900/70 p-6">
            <h3 className="mb-4 text-lg font-bold text-blue-200">Sessões de Jogo e Auditoria</h3>
            <div className="mb-4 grid gap-3 md:grid-cols-4">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por usuário/sessão"
                className="border-slate-700 bg-slate-950/70 text-white"
              />
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              >
                <option value="all">Todos status</option>
                <option value="running">running</option>
                <option value="ended">ended</option>
                <option value="collision">collision</option>
                <option value="abandoned">abandoned</option>
                <option value="credited">credited</option>
              </select>
              <select
                value={dayFilter}
                onChange={(event) => setDayFilter(event.target.value)}
                className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              >
                <option value="all">Todas ilhas</option>
                {ISLAND_DAYS.map((day) => (
                  <option key={day} value={String(day)}>
                    Ilha {day}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-2 text-sm text-blue-100">
                <Badge className="bg-blue-600">{filteredSessions.length}</Badge>
                registros
              </div>
            </div>

            <div className="space-y-3">
              {filteredSessions.slice(0, 100).map((entry) => {
                const userData = usersById.get(entry.user_id);
                return (
                  <div
                    key={entry.id}
                    className="rounded-xl border border-slate-700 bg-slate-950/65 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold text-white">
                          {entry.user_name || userData?.full_name || userData?.nick || "Sem nome"}{" "}
                          <span className="text-xs text-slate-400">({entry.user_nick || userData?.nick || "-"})</span>
                        </p>
                        <p className="text-xs text-slate-400">
                          Sessão {entry.id} • Ilha {entry.island_day} • Score {entry.score || 0} • Baú{" "}
                          {Math.round(Number(entry.chest_chance || 0))}%
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-slate-700">{entry.status || "unknown"}</Badge>
                        {entry.is_daily ? <Badge className="bg-amber-600">Diária</Badge> : null}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-emerald-700 bg-emerald-950/40 text-emerald-200"
                        onClick={() =>
                          markSessionMutation.mutate({
                            sessionId: entry.id,
                            patch: { status: "credited", reviewed_by: user?.id || "admin" },
                          })
                        }
                      >
                        Marcar revisado
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-amber-700 bg-amber-950/40 text-amber-200"
                        onClick={() =>
                          setCreditForm((prev) => ({
                            ...prev,
                            userId: entry.user_id || "",
                            sessionId: entry.id,
                            reason: prev.reason || "Ajuste manual de sessão ilha",
                          }))
                        }
                      >
                        Preparar crédito
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="credit">
          <Card className="border-amber-700/50 bg-slate-900/70 p-6">
            <h3 className="mb-4 text-lg font-bold text-amber-200">Crédito Manual (Admin)</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-amber-100">Usuário (ID)</Label>
                <Input
                  list="island-users-list"
                  value={creditForm.userId}
                  onChange={(event) => setCreditForm((prev) => ({ ...prev, userId: event.target.value }))}
                  placeholder="Cole o user_id"
                  className="border-slate-700 bg-slate-950/70 text-white"
                />
                <datalist id="island-users-list">
                  {users.slice(0, 300).map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.full_name || entry.nick || entry.email}
                    </option>
                  ))}
                </datalist>
              </div>
              <div className="space-y-1">
                <Label className="text-amber-100">Sessão (opcional)</Label>
                <Input
                  value={creditForm.sessionId}
                  onChange={(event) => setCreditForm((prev) => ({ ...prev, sessionId: event.target.value }))}
                  placeholder="ID da sessão de ilha"
                  className="border-slate-700 bg-slate-950/70 text-white"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-amber-100">Amount (inteiro)</Label>
                <Input
                  value={creditForm.amount}
                  onChange={(event) => setCreditForm((prev) => ({ ...prev, amount: event.target.value }))}
                  placeholder="Ex.: 10 ou -5"
                  className="border-slate-700 bg-slate-950/70 text-white"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-amber-100">Motivo</Label>
                <Input
                  value={creditForm.reason}
                  onChange={(event) => setCreditForm((prev) => ({ ...prev, reason: event.target.value }))}
                  placeholder="Ex.: Crédito por falha de recompensa"
                  className="border-slate-700 bg-slate-950/70 text-white"
                />
              </div>
            </div>

            <Button
              className="mt-5 bg-amber-600 hover:bg-amber-700"
              disabled={creditMutation.isPending}
              onClick={() => creditMutation.mutate()}
            >
              {creditMutation.isPending ? "Aplicando..." : "Aplicar Crédito Manual"}
            </Button>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
