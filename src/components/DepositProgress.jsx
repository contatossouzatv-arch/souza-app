import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TrendingUp, ExternalLink, Gift, AlertCircle, Check, ChevronDown, Wallet } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import CountdownTimer from "./CountdownTimer";
import { toast } from "@/components/ui/use-toast";
import { isInteractionSoundEnabled } from "@/lib/soundPrefs";
import depositSuccessSound from "../../assets-para-app/moeda effect song deposit.mp3";
import { useAppSettings } from "@/hooks/useAppSettings";

export default function DepositProgress({ totalApproved, pendingAmount, user, onDepositSubmit, promoEndDate, activeCycle }) {
  const queryClient = useQueryClient();
  const [submissionStatus, setSubmissionStatus] = useState("idle");
  const [formExpanded, setFormExpanded] = useState(false);
  const [amount, setAmount] = useState("");
  const [platformName, setPlatformName] = useState("");
  const [platformId, setPlatformId] = useState(user?.platform_id || "");
  const [showCheckMenu, setShowCheckMenu] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showFirstGoalMsg, setShowFirstGoalMsg] = useState(true);
  const formCardRef = React.useRef(null);
  const depositSuccessAudioRef = React.useRef(null);

  useEffect(() => {
    const audio = new Audio(depositSuccessSound);
    audio.preload = "auto";
    depositSuccessAudioRef.current = audio;
    return () => {
      depositSuccessAudioRef.current = null;
    };
  }, []);

  const { data: settings = [] } = useAppSettings();

  const { data: activePlatforms = [] } = useQuery({
    queryKey: ["active-platforms"],
    queryFn: async () => {
      const response = await base44.platforms.summary();
      return response.activePlatforms || [];
    },
  });

  const { data: cashbackClaims = [] } = useQuery({
    queryKey: ["my-cashback-claims", user?.id],
    queryFn: async () => {
      const response = await base44.cashback.status();
      return response.items || [];
    },
    enabled: !!user,
  });

  const depositsEnabled = settings.find((s) => s.key === "deposits_enabled")?.value === "true";
  const cashbackActive = settings.find((s) => s.key === "cashback_active")?.value === "true";
  const depositCheckOptions = React.useMemo(() => {
    const map = new Map();

    settings.forEach((entry) => {
      const key = String(entry?.key || "").trim();
      let match = key.match(/^deposit_check_link(?:_(\d+))?$/);
      if (match) {
        const index = match[1] ? Math.max(0, Number(match[1]) - 1) : 0;
        const current = map.get(index) || { label: "", link: "" };
        current.link = entry?.value || "";
        map.set(index, current);
        return;
      }
      match = key.match(/^deposit_check_name(?:_(\d+))?$/);
      if (match) {
        const index = match[1] ? Math.max(0, Number(match[1]) - 1) : 0;
        const current = map.get(index) || { label: "", link: "" };
        current.label = entry?.value || "";
        map.set(index, current);
      }
    });

    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([index, value]) => ({
        value: `platform_${index + 1}`,
        label: String(value.label || activePlatforms?.[index]?.name || `Plataforma ${index + 1}`),
        link: String(value.link || ""),
      }))
      .filter((item) => item.link);
  }, [activePlatforms, settings]);
  const cashbackRedeemLink = settings.find((s) => s.key === "cashback_redeem_link")?.value || "#";
  const shouldRenderCashback = cashbackActive;

  const firstGoalClaimed = cashbackClaims.find((c) => c.goal_type === "first_goal" && c.claimed);

  let nextGoal = 1000;
  let isSecondPhase = false;

  if (totalApproved >= 1000) {
    nextGoal = null;
    isSecondPhase = true;
  } else if (totalApproved >= 500) {
    nextGoal = 1000;
    isSecondPhase = true;
  }

  const percentage = isSecondPhase
    ? Math.min((totalApproved / 1000) * 100, 100)
    : Math.min((totalApproved / 500) * 100, 100);

  const remaining = nextGoal ? Math.max(nextGoal - totalApproved, 0) : 0;
  const reachedFirstGoal = totalApproved >= 500;
  const reachedSecondGoal = totalApproved >= 1000;

  const claimMutation = useMutation({
    mutationFn: async (goalType) => base44.cashback.claim(goalType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-cashback-claims"] });
      if (!reachedSecondGoal) {
        setShowFirstGoalMsg(false);
      }
    },
  });

  useEffect(() => {
    let start = 0;
    const end = percentage;
    const duration = 900;
    const increment = end / (duration / 16);

    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setProgress(end);
        clearInterval(timer);
      } else {
        setProgress(start);
      }
    }, 16);

    return () => clearInterval(timer);
  }, [totalApproved, percentage]);

  useEffect(() => {
    if (!formExpanded) return;
    const timer = setTimeout(() => {
      formCardRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 120);
    return () => clearTimeout(timer);
  }, [formExpanded]);

  useEffect(() => {
    if (submissionStatus === "idle") return;
    const timer = setTimeout(() => {
      formCardRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 60);
    return () => clearTimeout(timer);
  }, [submissionStatus]);

  if (!shouldRenderCashback) return null;

  const handleSubmit = async () => {
    if (!depositsEnabled) {
      toast({
        variant: "destructive",
        title: "Registro desabilitado",
        description: "Os depósitos estão temporariamente indisponíveis.",
      });
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      toast({
        variant: "destructive",
        title: "Valor inválido",
        description: "Digite um valor de deposito valido.",
      });
      return;
    }

    if (!platformName || !platformId) {
      toast({
        variant: "destructive",
        title: "Campos obrigatorios",
        description: "Preencha o nome da plataforma e o ID.",
      });
      return;
    }

    if (!activeCycle) {
      toast({
        variant: "destructive",
        title: "Sem ciclo ativo",
        description: "Aguarde a abertura de um novo ciclo de sorteio.",
      });
      return;
    }

    const minLoadingMs = 3000;
    const startedAt = Date.now();
    setLoading(true);
    setSubmissionStatus("loading");
    try {
      await base44.deposits.create({
        amount: parseFloat(amount),
        platformName,
        userPlatformId: platformId,
        cycleId: activeCycle.id,
        userName: user.full_name || user.nick,
      });

      setAmount("");
      setPlatformName("");
      setPlatformId(user?.platform_id || "");

      queryClient.invalidateQueries({ queryKey: ["deposits"] });
      queryClient.invalidateQueries({ queryKey: ["user-deposit-history"] });
      queryClient.invalidateQueries({ queryKey: ["all-deposits"] });

      if (onDepositSubmit) onDepositSubmit();

      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(0, minLoadingMs - elapsed);
      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, remaining));
      }

      setSubmissionStatus("success");
      if (isInteractionSoundEnabled()) {
        const audio = depositSuccessAudioRef.current;
        if (audio) {
          audio.currentTime = 0;
          audio.play().catch(() => {});
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 3000));
      setFormExpanded(false);
      setSubmissionStatus("idle");
    } catch (error) {
      setSubmissionStatus("idle");
      toast({
        variant: "destructive",
        title: "Erro ao registrar deposito",
        description: error?.message || "Tente novamente.",
      });
    }
    setLoading(false);
  };

  const handleOpenDepositCheck = (link) => {
    if (!link) {
      toast({
        variant: "destructive",
        title: "Link indisponivel",
        description: "Nenhum link de conferencia foi configurado no painel.",
      });
      return;
    }
    window.open(link, "_blank");
    setShowCheckMenu(false);
  };

  return (
    <>
      <Card className={`relative overflow-hidden bg-gradient-to-br from-purple-900/50 to-pink-900/50 border-purple-700/50 ${!depositsEnabled ? "opacity-60" : ""}`}>
        {promoEndDate ? (
          <div className="absolute top-4 right-4 z-10">
            <CountdownTimer endDateString={promoEndDate} />
          </div>
        ) : null}

        <div className="relative p-5 pt-16">
          <div className="flex items-center gap-2 mb-4">
            <Gift className="w-6 h-6 text-yellow-400" />
            <h3 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-pink-300">
              {isSecondPhase ? "Meta Final: 10% Cashback + 100 Bilhetes" : "Cashback + 50 Bilhetes"}
            </h3>
          </div>

          <div className="mb-4 rounded-2xl border border-emerald-500/35 bg-gradient-to-br from-emerald-950/60 via-slate-950/45 to-cyan-950/25 p-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-emerald-200/90">Progresso da meta</p>
                <p className="text-2xl font-extrabold text-emerald-300">{progress.toFixed(0)}%</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-300">R$ {totalApproved.toFixed(2)} depositados</p>
                <p className="text-sm font-semibold text-yellow-300">Pendente: R$ {pendingAmount.toFixed(2)}</p>
              </div>
            </div>

            <div className="mt-3">
              <div className="relative h-3.5 w-full overflow-hidden rounded-full border border-emerald-500/40 bg-emerald-950/60">
                <div
                  className="h-full bg-gradient-to-r from-emerald-400 via-green-400 to-cyan-400 transition-all duration-500"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-emerald-200/90">
                <span>Início</span>
                <span>{isSecondPhase ? "R$ 500" : "R$ 250"}</span>
                <span>{isSecondPhase ? "R$ 1000" : "R$ 500"}</span>
              </div>
            </div>
          </div>

          <div className="w-full space-y-2 text-center">
            {reachedSecondGoal ? (
              <div className="px-3 py-3 bg-gradient-to-r from-yellow-600/30 to-orange-600/30 border border-yellow-500/50 rounded-lg">
                <p className="text-lg font-bold text-yellow-300 mb-2">Meta final alcancada!</p>
                <p className="text-sm text-yellow-200 mb-3">10% Cashback + 100 bilhetes extra liberados.</p>
                <a href={cashbackRedeemLink} target="_blank" rel="noopener noreferrer">
                  <Button className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700">
                    Resgate aqui
                  </Button>
                </a>
              </div>
            ) : reachedFirstGoal && showFirstGoalMsg && !firstGoalClaimed ? (
              <>
                <div className="px-3 py-3 bg-gradient-to-r from-yellow-600/30 to-orange-600/30 border border-yellow-500/50 rounded-lg mb-2">
                  <p className="text-lg font-bold text-yellow-300 mb-2">Primeira meta alcancada!</p>
                  <p className="text-sm text-yellow-200 mb-3">50 bilhetes extra liberados.</p>
                  <div className="flex gap-2">
                    <a href={cashbackRedeemLink} target="_blank" rel="noopener noreferrer" className="flex-1">
                      <Button className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700">
                        Resgate aqui
                      </Button>
                    </a>
                    <Button
                      onClick={() => claimMutation.mutate("first_goal")}
                      variant="outline"
                      className="border-green-600 text-green-400 hover:bg-green-900/30"
                    >
                      <Check className="w-4 h-4 mr-1" />
                      Ja resgatei
                    </Button>
                  </div>
                </div>
                <div className="px-3 py-3 bg-gradient-to-r from-blue-600/30 to-cyan-600/30 border border-blue-500/50 rounded-lg">
                  <p className="text-base font-bold text-blue-200 mb-2">Segunda fase liberada</p>
                  <p className="text-sm text-blue-300">
                    Faltam R$ {remaining.toFixed(2)} para ganhar 10% de cashback + 100 bilhetes extras.
                  </p>
                </div>
              </>
            ) : isSecondPhase ? (
              <div className="px-3 py-2 bg-orange-900/30 border border-orange-600/50 rounded-lg">
                <p className="text-sm font-bold text-orange-300">Faltam R$ {remaining.toFixed(2)}</p>
                <p className="text-xs text-orange-200">para ganhar 10% de cashback + 100 bilhetes extras.</p>
              </div>
            ) : (
              <div className="px-3 py-2 bg-orange-900/30 border border-orange-600/50 rounded-lg">
                <p className="text-sm font-bold text-orange-300">Faltam R$ {(500 - totalApproved).toFixed(2)}</p>
                <p className="text-xs text-orange-200">para ganhar 50 bilhetes extras.</p>
              </div>
            )}

            {pendingAmount > 0 ? (
              <div className="px-3 py-2 bg-blue-900/30 border border-blue-600/50 rounded-lg">
                <p className="text-sm font-bold text-blue-300 flex items-center justify-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Aguardando liberação de R$ {pendingAmount.toFixed(2)}
                </p>
              </div>
            ) : null}

            {!depositsEnabled ? (
              <div className="px-3 py-2 bg-red-900/30 border border-red-600/50 rounded-lg">
                <p className="text-xs text-red-200">Novos depósitos temporariamente indisponíveis</p>
              </div>
            ) : null}
          </div>
        </div>
      </Card>

      <Card ref={formCardRef} className="relative bg-gradient-to-br from-slate-900/70 to-slate-800/70 border-slate-700/60 overflow-hidden">
        {submissionStatus !== "idle" ? (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-slate-950/90 px-4 text-center">
            {submissionStatus === "loading" ? (
              <>
                <div className="h-9 w-9 animate-spin rounded-full border-2 border-emerald-300/30 border-t-emerald-300" />
                <p className="text-sm font-semibold text-emerald-100">Registrando deposito...</p>
              </>
            ) : (
              <p className="text-base font-bold text-emerald-300">DEPOSITO REGISTRADO COM SUCESSO</p>
            )}
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => setFormExpanded((prev) => !prev)}
          className="w-full flex items-center justify-between px-4 py-4 text-left"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-500/40 bg-emerald-500/15">
              <Wallet className="h-4 w-4 text-emerald-300" />
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide">Depósitos</p>
              <h4 className="text-base font-bold text-white">PREENCHER NOVO DEPOSITO</h4>
            </div>
          </div>
          <ChevronDown className={`w-5 h-5 text-slate-300 transition-transform ${formExpanded ? "rotate-180" : ""}`} />
        </button>

        <div
          className={`overflow-hidden border-t border-slate-700/60 transition-all duration-300 ease-in-out ${
            formExpanded ? "max-h-[560px] opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <div className="px-4 pb-4 pt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="amount" className="text-slate-200">Valor do Deposito (R$)</Label>
              <Input
                id="amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="bg-slate-900/70 border-slate-700 text-white placeholder:text-slate-500 text-lg"
                step="0.01"
                min="0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="platformName" className="text-slate-200">Nome da Plataforma</Label>
              <Input
                id="platformName"
                value={platformName}
                onChange={(e) => setPlatformName(e.target.value)}
                placeholder="Ex: PG, Reals, etc"
                className="bg-slate-900/70 border-slate-700 text-white placeholder:text-slate-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="platformId" className="text-slate-200">ID CORRESPONDENTE AO DEPOSITO</Label>
              <Input
                id="platformId"
                value={platformId}
                onChange={(e) => setPlatformId(e.target.value)}
                placeholder="Digite o ID correspondente ao deposito"
                className="bg-slate-900/70 border-slate-700 text-white placeholder:text-slate-500"
              />
            </div>

            <p className="text-xs text-slate-400">
              A cada R$50 acumulado = 50 bilhetes | A cada R$100 acumulado = 100 bilhetes.
            </p>

            <div className="flex gap-2">
              <Button
                onClick={handleSubmit}
                disabled={loading || !depositsEnabled}
                className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
              >
                <TrendingUp className="w-4 h-4 mr-2" />
                {loading ? "Registrando..." : "Registrar"}
              </Button>

              <Button
                onClick={() => setShowCheckMenu(true)}
                variant="outline"
                className="border-cyan-500/70 bg-cyan-500/20 text-cyan-100 hover:bg-cyan-500/30 hover:text-white"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Conferir
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {showCheckMenu ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4" onClick={() => setShowCheckMenu(false)}>
          <div
            className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-3 text-center text-sm font-semibold text-white">Escolha a plataforma</p>
            <div className="space-y-2">
              {depositCheckOptions.map((option) => (
                <Button
                  key={option.value}
                  onClick={() => handleOpenDepositCheck(option.link)}
                  className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700"
                >
                  {option.label}
                </Button>
              ))}
              {!depositCheckOptions.length ? (
                <p className="rounded-lg border border-red-500/40 bg-red-950/40 px-3 py-2 text-center text-xs text-red-200">
                  Nenhum link configurado.
                </p>
              ) : null}
              <Button
                variant="outline"
                onClick={() => setShowCheckMenu(false)}
                className="w-full border-slate-600 text-slate-200 hover:bg-slate-800"
              >
                Fechar
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

