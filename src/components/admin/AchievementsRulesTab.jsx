import React, { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import {
  BADGE_COLOR_OPTIONS,
  BADGE_ICON_OPTIONS,
  BADGE_METRIC_OPTIONS,
  DEFAULT_BADGE_RULES,
  DEFAULT_POINTS_RULES,
  normalizeBadgeRules,
  normalizePointsRules,
  parseJsonSetting,
} from "@/lib/achievementRules";
import {
  DEFAULT_PROFILE_COMPETITION_CONFIG,
  normalizeCompetitionConfig,
  PROFILE_COMPETITION_SETTINGS_KEY,
} from "@/lib/profileCompetition";
import {
  DEFAULT_PROFILE_ENGAGEMENT_GUIDE_CONFIG,
  normalizeEngagementGuideConfig,
  PROFILE_ENGAGEMENT_GUIDE_SETTINGS_KEY,
} from "@/lib/profileEngagementGuide";

const BADGES_KEY = "achievement_badge_rules_v1";
const POINTS_KEY = "achievement_points_rules_v1";
const COMPETITION_KEY = PROFILE_COMPETITION_SETTINGS_KEY;
const ENGAGEMENT_GUIDE_KEY = PROFILE_ENGAGEMENT_GUIDE_SETTINGS_KEY;
const ANIMATED_BADGE_OPTIONS = [
  { id: "starter-install", label: "Iniciante da Comunidade", asset: "selo 001 app.webm" },
  { id: "winner", label: "Ganhou seu primeiro premio", asset: "selo ganhou seu primeiro premio.webm" },
  { id: "winner10", label: "Ganhou 10 premios", asset: "selo ganhou 10 premios.webm" },
  { id: "live-10", label: "Participou de 10 lives", asset: "selo participou de 10 lives.webm" },
  { id: "tickets-500", label: "Acumulou 500 bilhetes", asset: "selo acumulou 500 bilhetes nos depositos.webm" },
  { id: "followers-50", label: "Atingiu 50 seguidores", asset: "selo atingiu 50 seguidores no perfil.webm" },
  { id: "checkin-30", label: "Check-in 30 dias", asset: "selo fez check in 30 dias no app.webm" },
];

function newBadgeRule() {
  return {
    id: `badge-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    enabled: true,
    label: "Novo selo",
    metric: "points",
    threshold: 100,
    icon: "star",
    color: "cyan",
    icon_url: "",
    description: "",
  };
}

function newEngagementRule() {
  return {
    id: `engagement-rule-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    title: "Nova regra",
    description: "",
  };
}

export default function AchievementsRulesTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [pointsRules, setPointsRules] = useState(DEFAULT_POINTS_RULES);
  const [badgeRules, setBadgeRules] = useState(DEFAULT_BADGE_RULES);
  const [competitionConfig, setCompetitionConfig] = useState(DEFAULT_PROFILE_COMPETITION_CONFIG);
  const [engagementGuideConfig, setEngagementGuideConfig] = useState(DEFAULT_PROFILE_ENGAGEMENT_GUIDE_CONFIG);
  const [activeModule, setActiveModule] = useState("engagement");

  const { data: settings = [], isLoading } = useQuery({
    queryKey: ["achievement-rules-admin-settings"],
    queryFn: () => base44.entities.AppSettings.list(),
    staleTime: 15000,
  });

  useEffect(() => {
    const badgesRaw = settings.find((s) => s.key === BADGES_KEY)?.value || "";
    const pointsRaw = settings.find((s) => s.key === POINTS_KEY)?.value || "";
    const competitionRaw = settings.find((s) => s.key === COMPETITION_KEY)?.value || "";
    const engagementGuideRaw = settings.find((s) => s.key === ENGAGEMENT_GUIDE_KEY)?.value || "";

    setBadgeRules(normalizeBadgeRules(parseJsonSetting(badgesRaw, DEFAULT_BADGE_RULES)));
    setPointsRules(normalizePointsRules(parseJsonSetting(pointsRaw, DEFAULT_POINTS_RULES)));
    setCompetitionConfig(
      normalizeCompetitionConfig(parseJsonSetting(competitionRaw, DEFAULT_PROFILE_COMPETITION_CONFIG))
    );
    setEngagementGuideConfig(
      normalizeEngagementGuideConfig(parseJsonSetting(engagementGuideRaw, DEFAULT_PROFILE_ENGAGEMENT_GUIDE_CONFIG))
    );
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const upsertSetting = async (key, value, description) => {
        const existing = settings.find((s) => s.key === key);
        const payload = { value: JSON.stringify(value), description };
        if (existing?.id) {
          await base44.entities.AppSettings.update(existing.id, payload);
        } else {
          await base44.entities.AppSettings.create({ key, ...payload });
        }
      };

      await upsertSetting(BADGES_KEY, normalizeBadgeRules(badgeRules), "Regras de selos de conquista");
      await upsertSetting(POINTS_KEY, normalizePointsRules(pointsRules), "Regras de pontuacao da pagina de perfil");
      await upsertSetting(
        COMPETITION_KEY,
        normalizeCompetitionConfig(competitionConfig),
        "Configuracao do ciclo competitivo publico de perfil"
      );
      await upsertSetting(
        ENGAGEMENT_GUIDE_KEY,
        normalizeEngagementGuideConfig(engagementGuideConfig),
        "Configuracao do modal de regras do ranking Mais Engajados"
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["achievement-rules-admin-settings"] });
      queryClient.invalidateQueries({ queryKey: ["achievement-rules-profile-settings"] });
      toast({
        title: "Regras salvas",
        description: "Selos, pontuacao, ciclo competitivo e regras de Mais Engajados foram atualizados.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erro ao salvar",
        description: error?.message || "Nao foi possivel salvar agora.",
      });
    },
  });

  return (
    <div className="space-y-4">
      <Card className="border-slate-800 bg-slate-900/70 p-4">
        <h2 className="text-base font-bold text-white">Controle de Selos, Pontos e Competicao</h2>
        <p className="mt-1 text-sm text-slate-300">
          Ajuste as regras da gamificacao, o ciclo competitivo e o guia do card Mais Engajados.
        </p>
      </Card>

      <Card className="border-slate-800 bg-slate-900/70 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Modulos de configuracao</p>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <button
            type="button"
            onClick={() => setActiveModule("engagement")}
            className={`rounded-xl border p-3 text-left transition ${
              activeModule === "engagement"
                ? "border-cyan-500/80 bg-cyan-500/15 text-cyan-100"
                : "border-slate-700 bg-slate-900/80 text-slate-300 hover:border-slate-500"
            }`}
          >
            <p className="text-sm font-bold">Mais Engajados</p>
            <p className="mt-1 text-xs opacity-80">Regras do card e ranking vitalicio</p>
          </button>
          <button
            type="button"
            onClick={() => setActiveModule("competition")}
            className={`rounded-xl border p-3 text-left transition ${
              activeModule === "competition"
                ? "border-cyan-500/80 bg-cyan-500/15 text-cyan-100"
                : "border-slate-700 bg-slate-900/80 text-slate-300 hover:border-slate-500"
            }`}
          >
            <p className="text-sm font-bold">Competicao</p>
            <p className="mt-1 text-xs opacity-80">Ciclo, premio e tarefas</p>
          </button>
          <button
            type="button"
            onClick={() => setActiveModule("points")}
            className={`rounded-xl border p-3 text-left transition ${
              activeModule === "points"
                ? "border-cyan-500/80 bg-cyan-500/15 text-cyan-100"
                : "border-slate-700 bg-slate-900/80 text-slate-300 hover:border-slate-500"
            }`}
          >
            <p className="text-sm font-bold">Pontuacao</p>
            <p className="mt-1 text-xs opacity-80">Pesos e metas globais</p>
          </button>
          <button
            type="button"
            onClick={() => setActiveModule("badges")}
            className={`rounded-xl border p-3 text-left transition ${
              activeModule === "badges"
                ? "border-cyan-500/80 bg-cyan-500/15 text-cyan-100"
                : "border-slate-700 bg-slate-900/80 text-slate-300 hover:border-slate-500"
            }`}
          >
            <p className="text-sm font-bold">Selos</p>
            <p className="mt-1 text-xs opacity-80">Criar e editar conquistas</p>
          </button>
        </div>
      </Card>

      {activeModule === "engagement" ? (
      <Card className="border-slate-800 bg-slate-900/70 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Guia do Mais Engajados</h3>
          <Button
            type="button"
            onClick={() =>
              setEngagementGuideConfig((prev) => ({
                ...prev,
                rules: [...prev.rules, newEngagementRule()],
              }))
            }
            className="bg-cyan-700 text-white hover:bg-cyan-600"
          >
            Adicionar regra
          </Button>
        </div>
        <div className="mb-3 rounded-xl border border-slate-700 bg-slate-900/80 p-3">
          <label className="inline-flex items-center gap-2 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={Boolean(engagementGuideConfig.enabled)}
              onChange={(e) => setEngagementGuideConfig((prev) => ({ ...prev, enabled: e.target.checked }))}
              className="h-4 w-4 rounded border-slate-500 bg-slate-800"
            />
            Exibir link de instrucoes no card Mais Engajados
          </label>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label className="mb-1 block text-slate-300">Texto do link</Label>
            <Input
              value={engagementGuideConfig.link_label}
              onChange={(e) => setEngagementGuideConfig((prev) => ({ ...prev, link_label: e.target.value }))}
              className="border-slate-700 bg-slate-900 text-white"
            />
          </div>
          <div>
            <Label className="mb-1 block text-slate-300">Titulo do modal</Label>
            <Input
              value={engagementGuideConfig.modal_title}
              onChange={(e) => setEngagementGuideConfig((prev) => ({ ...prev, modal_title: e.target.value }))}
              className="border-slate-700 bg-slate-900 text-white"
            />
          </div>
          <div className="md:col-span-2">
            <Label className="mb-1 block text-slate-300">Subtitulo do modal</Label>
            <Input
              value={engagementGuideConfig.modal_subtitle}
              onChange={(e) => setEngagementGuideConfig((prev) => ({ ...prev, modal_subtitle: e.target.value }))}
              className="border-slate-700 bg-slate-900 text-white"
            />
          </div>
          <div className="md:col-span-2">
            <Label className="mb-1 block text-slate-300">Texto de destaque</Label>
            <Textarea
              value={engagementGuideConfig.highlight_text}
              onChange={(e) => setEngagementGuideConfig((prev) => ({ ...prev, highlight_text: e.target.value }))}
              rows={2}
              className="border-slate-700 bg-slate-900 text-white"
            />
          </div>
          <div className="md:col-span-2">
            <Label className="mb-1 block text-slate-300">Instrucoes gerais (um item por linha)</Label>
            <Textarea
              value={engagementGuideConfig.instructions}
              onChange={(e) => setEngagementGuideConfig((prev) => ({ ...prev, instructions: e.target.value }))}
              rows={4}
              className="border-slate-700 bg-slate-900 text-white"
            />
          </div>
          <div>
            <Label className="mb-1 block text-slate-300">Peso por dia ativo</Label>
            <Input
              type="number"
              min="0"
              step="0.1"
              value={engagementGuideConfig.ranking_weights.points_per_active_day}
              onChange={(e) =>
                setEngagementGuideConfig((prev) => ({
                  ...prev,
                  ranking_weights: {
                    ...prev.ranking_weights,
                    points_per_active_day: Number(e.target.value || 0),
                  },
                }))
              }
              className="border-slate-700 bg-slate-900 text-white"
            />
          </div>
          <div>
            <Label className="mb-1 block text-slate-300">Peso por acao no app</Label>
            <Input
              type="number"
              min="0"
              step="0.1"
              value={engagementGuideConfig.ranking_weights.points_per_activity}
              onChange={(e) =>
                setEngagementGuideConfig((prev) => ({
                  ...prev,
                  ranking_weights: {
                    ...prev.ranking_weights,
                    points_per_activity: Number(e.target.value || 0),
                  },
                }))
              }
              className="border-slate-700 bg-slate-900 text-white"
            />
          </div>
          <div>
            <Label className="mb-1 block text-slate-300">Peso por R$ depositado</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={engagementGuideConfig.ranking_weights.points_per_brl_deposit}
              onChange={(e) =>
                setEngagementGuideConfig((prev) => ({
                  ...prev,
                  ranking_weights: {
                    ...prev.ranking_weights,
                    points_per_brl_deposit: Number(e.target.value || 0),
                  },
                }))
              }
              className="border-slate-700 bg-slate-900 text-white"
            />
          </div>
          <div>
            <Label className="mb-1 block text-slate-300">Dias de boost para novos</Label>
            <Input
              type="number"
              min="0"
              value={engagementGuideConfig.ranking_weights.newcomer_boost_days}
              onChange={(e) =>
                setEngagementGuideConfig((prev) => ({
                  ...prev,
                  ranking_weights: {
                    ...prev.ranking_weights,
                    newcomer_boost_days: Number(e.target.value || 0),
                  },
                }))
              }
              className="border-slate-700 bg-slate-900 text-white"
            />
          </div>
          <div className="md:col-span-2">
            <Label className="mb-1 block text-slate-300">Multiplicador de boost de novos usuarios</Label>
            <Input
              type="number"
              min="1"
              step="0.01"
              value={engagementGuideConfig.ranking_weights.newcomer_multiplier}
              onChange={(e) =>
                setEngagementGuideConfig((prev) => ({
                  ...prev,
                  ranking_weights: {
                    ...prev.ranking_weights,
                    newcomer_multiplier: Number(e.target.value || 1),
                  },
                }))
              }
              className="border-slate-700 bg-slate-900 text-white"
            />
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Regras detalhadas</p>
          {engagementGuideConfig.rules.map((rule) => (
            <div key={rule.id} className="grid gap-2 rounded-xl border border-slate-700 bg-slate-900/80 p-3 md:grid-cols-12">
              <div className="md:col-span-4">
                <Label className="mb-1 block text-slate-300">Titulo</Label>
                <Input
                  value={rule.title}
                  onChange={(e) =>
                    setEngagementGuideConfig((prev) => ({
                      ...prev,
                      rules: prev.rules.map((item) => (item.id === rule.id ? { ...item, title: e.target.value } : item)),
                    }))
                  }
                  className="border-slate-700 bg-slate-900 text-white"
                />
              </div>
              <div className="md:col-span-7">
                <Label className="mb-1 block text-slate-300">Descricao</Label>
                <Input
                  value={rule.description}
                  onChange={(e) =>
                    setEngagementGuideConfig((prev) => ({
                      ...prev,
                      rules: prev.rules.map((item) =>
                        item.id === rule.id ? { ...item, description: e.target.value } : item
                      ),
                    }))
                  }
                  className="border-slate-700 bg-slate-900 text-white"
                />
              </div>
              <div className="flex items-end md:col-span-1">
                <Button
                  type="button"
                  onClick={() =>
                    setEngagementGuideConfig((prev) => ({
                      ...prev,
                      rules: prev.rules.filter((item) => item.id !== rule.id),
                    }))
                  }
                  className="h-10 w-full bg-rose-700 px-2 text-xs text-white hover:bg-rose-600"
                >
                  X
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
      ) : null}

      {activeModule === "competition" ? (
      <Card className="border-slate-800 bg-slate-900/70 p-4">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-300">Ciclo Competitivo Publico</h3>
        <div className="mb-3 rounded-xl border border-slate-700 bg-slate-900/80 p-3">
          <label className="inline-flex items-center gap-2 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={Boolean(competitionConfig.enabled)}
              onChange={(e) => setCompetitionConfig((prev) => ({ ...prev, enabled: e.target.checked }))}
              className="h-4 w-4 rounded border-slate-500 bg-slate-800"
            />
            Exibir box competitivo no perfil
          </label>
        </div>
        <div className="mb-3">
          <Label className="mb-1 block text-slate-300">Simulacao visual do box</Label>
          <select
            value={competitionConfig.preview_mode || "real"}
            onChange={(e) => setCompetitionConfig((prev) => ({ ...prev, preview_mode: e.target.value }))}
            className="h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-white"
          >
            <option value="real">Ciclo real (sem simulacao)</option>
            <option value="live">Ao vivo (contador rodando)</option>
            <option value="finished">Finalizado (contador encerrado)</option>
          </select>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label className="mb-1 block text-slate-300">Titulo do box</Label>
            <Input
              value={competitionConfig.title}
              onChange={(e) => setCompetitionConfig((prev) => ({ ...prev, title: e.target.value }))}
              className="border-slate-700 bg-slate-900 text-white"
            />
          </div>
          <div>
            <Label className="mb-1 block text-slate-300">Subtitulo</Label>
            <Input
              value={competitionConfig.subtitle}
              onChange={(e) => setCompetitionConfig((prev) => ({ ...prev, subtitle: e.target.value }))}
              className="border-slate-700 bg-slate-900 text-white"
            />
          </div>
          <div>
            <Label className="mb-1 block text-slate-300">Dias por ciclo</Label>
            <Input
              type="number"
              min="1"
              value={competitionConfig.cycle_days}
              onChange={(e) => setCompetitionConfig((prev) => ({ ...prev, cycle_days: Number(e.target.value || 1) }))}
              className="border-slate-700 bg-slate-900 text-white"
            />
          </div>
          <div>
            <Label className="mb-1 block text-slate-300">Data ancora do ciclo (ISO)</Label>
            <Input
              value={competitionConfig.cycle_anchor_date}
              onChange={(e) => setCompetitionConfig((prev) => ({ ...prev, cycle_anchor_date: e.target.value }))}
              className="border-slate-700 bg-slate-900 text-white"
              placeholder="2026-01-01T00:00:00.000Z"
            />
          </div>
          <div>
            <Label className="mb-1 block text-slate-300">Quantidade de ganhadores</Label>
            <Input
              type="number"
              min="1"
              value={competitionConfig.winners_count}
              onChange={(e) =>
                setCompetitionConfig((prev) => ({ ...prev, winners_count: Number(e.target.value || 1) }))
              }
              className="border-slate-700 bg-slate-900 text-white"
            />
          </div>
          <div>
            <Label className="mb-1 block text-slate-300">Valor da banca (R$)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={competitionConfig.reward_amount}
              onChange={(e) =>
                setCompetitionConfig((prev) => ({ ...prev, reward_amount: Number(e.target.value || 0) }))
              }
              className="border-slate-700 bg-slate-900 text-white"
            />
          </div>
          <div className="md:col-span-2">
            <Label className="mb-1 block text-slate-300">URL da moldura PNG do Top 3 (opcional)</Label>
            <Input
              value={competitionConfig.top3_frame_url || ""}
              onChange={(e) => setCompetitionConfig((prev) => ({ ...prev, top3_frame_url: e.target.value }))}
              className="border-slate-700 bg-slate-900 text-white"
              placeholder="https://.../moldura-top3.png"
            />
          </div>
          <div className="md:col-span-2">
            <Label className="mb-1 block text-slate-300">Instrucoes (um item por linha)</Label>
            <Textarea
              value={competitionConfig.instructions}
              onChange={(e) => setCompetitionConfig((prev) => ({ ...prev, instructions: e.target.value }))}
              rows={5}
              className="border-slate-700 bg-slate-900 text-white"
            />
          </div>
          <div>
            <Label className="mb-1 block text-slate-300">Titulo quando finaliza</Label>
            <Input
              value={competitionConfig.finished_title || ""}
              onChange={(e) => setCompetitionConfig((prev) => ({ ...prev, finished_title: e.target.value }))}
              className="border-slate-700 bg-slate-900 text-white"
            />
          </div>
          <div>
            <Label className="mb-1 block text-slate-300">Botao quando finaliza</Label>
            <Input
              value={competitionConfig.finished_cta_label || ""}
              onChange={(e) => setCompetitionConfig((prev) => ({ ...prev, finished_cta_label: e.target.value }))}
              className="border-slate-700 bg-slate-900 text-white"
            />
          </div>
          <div className="md:col-span-2">
            <Label className="mb-1 block text-slate-300">Subtitulo quando finaliza</Label>
            <Textarea
              value={competitionConfig.finished_subtitle || ""}
              onChange={(e) => setCompetitionConfig((prev) => ({ ...prev, finished_subtitle: e.target.value }))}
              rows={2}
              className="border-slate-700 bg-slate-900 text-white"
            />
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Tarefas que geram pontos</p>
          {competitionConfig.tasks.map((task, index) => (
            <div key={task.id} className="grid gap-2 rounded-xl border border-slate-700 bg-slate-900/80 p-3 md:grid-cols-12">
              <div className="md:col-span-4">
                <Label className="mb-1 block text-slate-300">Nome da tarefa</Label>
                <Input
                  value={task.label}
                  onChange={(e) =>
                    setCompetitionConfig((prev) => {
                      const next = [...prev.tasks];
                      next[index] = { ...task, label: e.target.value };
                      return { ...prev, tasks: next };
                    })
                  }
                  className="border-slate-700 bg-slate-900 text-white"
                />
              </div>
              <div className="md:col-span-2">
                <Label className="mb-1 block text-slate-300">Pontos</Label>
                <Input
                  type="number"
                  min="0"
                  value={task.points}
                  onChange={(e) =>
                    setCompetitionConfig((prev) => {
                      const next = [...prev.tasks];
                      next[index] = { ...task, points: Number(e.target.value || 0) };
                      return { ...prev, tasks: next };
                    })
                  }
                  className="border-slate-700 bg-slate-900 text-white"
                />
              </div>
              <div className="md:col-span-3">
                <Label className="mb-1 block text-slate-300">Passo de contagem</Label>
                <Input
                  type="number"
                  min="1"
                  value={task.step_value}
                  onChange={(e) =>
                    setCompetitionConfig((prev) => {
                      const next = [...prev.tasks];
                      next[index] = { ...task, step_value: Number(e.target.value || 1) };
                      return { ...prev, tasks: next };
                    })
                  }
                  className="border-slate-700 bg-slate-900 text-white"
                />
              </div>
              <div className="flex items-end md:col-span-3">
                <label className="inline-flex items-center gap-2 text-sm text-slate-200">
                  <input
                    type="checkbox"
                    checked={Boolean(task.enabled)}
                    onChange={(e) =>
                      setCompetitionConfig((prev) => {
                        const next = [...prev.tasks];
                        next[index] = { ...task, enabled: e.target.checked };
                        return { ...prev, tasks: next };
                      })
                    }
                    className="h-4 w-4 rounded border-slate-500 bg-slate-800"
                  />
                  Ativa
                </label>
              </div>
            </div>
          ))}
        </div>
      </Card>
      ) : null}

      {activeModule === "points" ? (
      <Card className="border-slate-800 bg-slate-900/70 p-4">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-300">Regras de Pontuacao</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label className="mb-1 block text-slate-300">Pontos por participacao</Label>
            <Input
              type="number"
              value={pointsRules.points_per_participation}
              onChange={(e) => setPointsRules((prev) => ({ ...prev, points_per_participation: Number(e.target.value || 0) }))}
              className="border-slate-700 bg-slate-900 text-white"
            />
          </div>
          <div>
            <Label className="mb-1 block text-slate-300">Pontos por deposito aprovado</Label>
            <Input
              type="number"
              value={pointsRules.points_per_approved_deposit}
              onChange={(e) => setPointsRules((prev) => ({ ...prev, points_per_approved_deposit: Number(e.target.value || 0) }))}
              className="border-slate-700 bg-slate-900 text-white"
            />
          </div>
          <div>
            <Label className="mb-1 block text-slate-300">Valor por etapa de bonus (R$)</Label>
            <Input
              type="number"
              value={pointsRules.amount_step_value}
              onChange={(e) => setPointsRules((prev) => ({ ...prev, amount_step_value: Number(e.target.value || 1) }))}
              className="border-slate-700 bg-slate-900 text-white"
            />
          </div>
          <div>
            <Label className="mb-1 block text-slate-300">Pontos por etapa de bonus</Label>
            <Input
              type="number"
              value={pointsRules.points_per_amount_step}
              onChange={(e) => setPointsRules((prev) => ({ ...prev, points_per_amount_step: Number(e.target.value || 0) }))}
              className="border-slate-700 bg-slate-900 text-white"
            />
          </div>
          <div>
            <Label className="mb-1 block text-slate-300">Pontos por premio ganho</Label>
            <Input
              type="number"
              value={pointsRules.points_per_win}
              onChange={(e) => setPointsRules((prev) => ({ ...prev, points_per_win: Number(e.target.value || 0) }))}
              className="border-slate-700 bg-slate-900 text-white"
            />
          </div>
          <div>
            <Label className="mb-1 block text-slate-300">Meta de progresso (participacoes)</Label>
            <Input
              type="number"
              value={pointsRules.progress_target_participations}
              onChange={(e) => setPointsRules((prev) => ({ ...prev, progress_target_participations: Number(e.target.value || 1) }))}
              className="border-slate-700 bg-slate-900 text-white"
            />
          </div>
          <div>
            <Label className="mb-1 block text-slate-300">Meta do selo Super Fa (lives)</Label>
            <Input
              type="number"
              value={pointsRules.live_badge_target}
              onChange={(e) => setPointsRules((prev) => ({ ...prev, live_badge_target: Number(e.target.value || 1) }))}
              className="border-slate-700 bg-slate-900 text-white"
            />
          </div>
        </div>
      </Card>
      ) : null}

      {activeModule === "badges" ? (
      <Card className="border-slate-800 bg-slate-900/70 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Selos de Conquista</h3>
          <Button
            type="button"
            onClick={() => setBadgeRules((prev) => [...prev, newBadgeRule()])}
            className="bg-cyan-700 text-white hover:bg-cyan-600"
          >
            Adicionar selo
          </Button>
        </div>

        <div className="space-y-3">
          {badgeRules.map((rule) => (
            <div key={rule.id} className="rounded-xl border border-slate-700 bg-slate-900/80 p-3">
              <div className="mb-2 flex items-center justify-between">
                <label className="inline-flex items-center gap-2 text-sm text-slate-200">
                  <input
                    type="checkbox"
                    checked={Boolean(rule.enabled)}
                    onChange={(e) =>
                      setBadgeRules((prev) =>
                        prev.map((item) => (item.id === rule.id ? { ...item, enabled: e.target.checked } : item))
                      )
                    }
                    className="h-4 w-4 rounded border-slate-500 bg-slate-800"
                  />
                  Ativo
                </label>
                <Button
                  type="button"
                  onClick={() => setBadgeRules((prev) => prev.filter((item) => item.id !== rule.id))}
                  className="h-8 bg-rose-700 px-2 text-xs text-white hover:bg-rose-600"
                >
                  Remover
                </Button>
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                <div className="md:col-span-2">
                  <Label className="mb-1 block text-slate-300">Selo animado vinculado</Label>
                  <select
                    value={rule.id}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      const selectedAnimated = ANIMATED_BADGE_OPTIONS.find((item) => item.id === selectedId);
                      setBadgeRules((prev) =>
                        prev.map((item) =>
                          item.id === rule.id
                            ? {
                                ...item,
                                id: selectedId,
                                label: selectedAnimated?.label || item.label,
                                icon_url: "",
                              }
                            : item
                        )
                      );
                    }}
                    className="h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-white"
                  >
                    {ANIMATED_BADGE_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Arquivo vinculado: {ANIMATED_BADGE_OPTIONS.find((item) => item.id === rule.id)?.asset || "Nao definido"}
                  </p>
                </div>
                <div className="md:col-span-2">
                  <Label className="mb-1 block text-slate-300">Nome do selo</Label>
                  <Input
                    value={rule.label}
                    onChange={(e) =>
                      setBadgeRules((prev) =>
                        prev.map((item) => (item.id === rule.id ? { ...item, label: e.target.value } : item))
                      )
                    }
                    className="border-slate-700 bg-slate-900 text-white"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label className="mb-1 block text-slate-300">Descricao da regra (texto exibido ao usuario)</Label>
                  <Input
                    value={rule.description || ""}
                    onChange={(e) =>
                      setBadgeRules((prev) =>
                        prev.map((item) => (item.id === rule.id ? { ...item, description: e.target.value } : item))
                      )
                    }
                    placeholder="Ex: Faca 3 depositos aprovados no ciclo atual."
                    className="border-slate-700 bg-slate-900 text-white"
                  />
                </div>
                <div>
                  <Label className="mb-1 block text-slate-300">Metrica</Label>
                  <select
                    value={rule.metric}
                    onChange={(e) =>
                      setBadgeRules((prev) =>
                        prev.map((item) => (item.id === rule.id ? { ...item, metric: e.target.value } : item))
                      )
                    }
                    className="h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-white"
                  >
                    {BADGE_METRIC_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="mb-1 block text-slate-300">Valor da regra</Label>
                  <Input
                    type="number"
                    value={rule.threshold}
                    onChange={(e) =>
                      setBadgeRules((prev) =>
                        prev.map((item) =>
                          item.id === rule.id ? { ...item, threshold: Number(e.target.value || 0) } : item
                        )
                      )
                    }
                    className="border-slate-700 bg-slate-900 text-white"
                  />
                </div>
                <div>
                  <Label className="mb-1 block text-slate-300">Icone</Label>
                  <select
                    value={rule.icon}
                    onChange={(e) =>
                      setBadgeRules((prev) =>
                        prev.map((item) => (item.id === rule.id ? { ...item, icon: e.target.value } : item))
                      )
                    }
                    className="h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-white"
                  >
                    {BADGE_ICON_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="mb-1 block text-slate-300">Cor</Label>
                  <select
                    value={rule.color}
                    onChange={(e) =>
                      setBadgeRules((prev) =>
                        prev.map((item) => (item.id === rule.id ? { ...item, color: e.target.value } : item))
                      )
                    }
                    className="h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-white"
                  >
                    {BADGE_COLOR_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
      ) : null}

      <div className="fixed bottom-24 right-5 z-[120] md:bottom-6 md:right-8">
        <Button
          type="button"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || isLoading}
          className="h-14 min-w-14 rounded-full bg-emerald-700 px-5 text-sm font-bold text-white shadow-[0_10px_30px_rgba(16,185,129,0.35)] hover:bg-emerald-600"
        >
          {saveMutation.isPending ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </div>
  );
}
