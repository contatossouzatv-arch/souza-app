import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Ticket, ExternalLink, AlertCircle, ChevronDown, Upload, X, Wallet } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import CountdownTimer from "./CountdownTimer";
import { toast } from "@/components/ui/use-toast";
import { isInteractionSoundEnabled } from "@/lib/soundPrefs";
import depositSuccessSound from "../../assets-para-app/moeda effect song deposit.mp3";
import { useAppSettings } from "@/hooks/useAppSettings";
import { usePlatformsSummary } from "@/hooks/usePlatformsSummary";
import { useAuth } from "@/lib/AuthContext";

const SUPPORTED_IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|gif)$/i;
const SUPPORTED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"]);
const MAX_PROOF_IMAGE_SIZE_BYTES = 40 * 1024 * 1024;
const safeFind = (list, predicate) => (Array.isArray(list) ? list.find(predicate) : undefined);

function buildProofUploadErrorMessage(error, failedCount = 0) {
  const rawMessage = String(error?.message || "").trim();
  const lowerMessage = rawMessage.toLowerCase();

  if (error?.status === 413 || lowerMessage.includes("file too large")) {
    return "Nao foi possivel carregar o comprovante porque o arquivo excede o limite permitido. Tente novamente com uma imagem menor.";
  }
  if (error?.status === 401 || error?.status === 403) {
    return "Sua sessao expirou durante o envio do comprovante. Entre novamente e tente de novo.";
  }
  if (lowerMessage.includes("failed to fetch") || lowerMessage.includes("networkerror") || lowerMessage.includes("network request failed")) {
    return "Nao foi possivel carregar o arquivo. Verifique sua internet e tente novamente.";
  }
  if (failedCount > 1) {
    return `Nao foi possivel carregar ${failedCount} comprovantes. Tente novamente.`;
  }
  return "Nao foi possivel carregar o arquivo. Tente novamente.";
}

export default function TicketsProgressBox({
  totalApproved,
  pendingAmount,
  user,
  onDepositSubmit,
  promoEndDate,
  activeCycle,
  settings: initialSettings = null,
  showProgressCard = true,
  showFormCard = true,
  isLoadingCycle = false,
}) {
  const ADD_NEW_PLATFORM_VALUE = "__add_new_platform__";
  const queryClient = useQueryClient();
  const { isLoadingAuth } = useAuth();
  const [submissionStatus, setSubmissionStatus] = useState("idle");
  const [formExpanded, setFormExpanded] = useState(false);
  const [amount, setAmount] = useState("");
  const [platformName, setPlatformName] = useState("");
  const [platformId, setPlatformId] = useState(user?.platform_id || "");
  const [selectedPlatformKey, setSelectedPlatformKey] = useState(ADD_NEW_PLATFORM_VALUE);
  const [proofImages, setProofImages] = useState([]);
  const [proofPreviewUrls, setProofPreviewUrls] = useState([]);
  const [proofUploadError, setProofUploadError] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState("");
  const [showCheckMenu, setShowCheckMenu] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
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

  const { data: queriedSettings = [] } = useAppSettings({
    enabled: !Array.isArray(initialSettings),
  });
  const safeSettings = Array.isArray(initialSettings)
    ? initialSettings
    : Array.isArray(queriedSettings)
      ? queriedSettings
      : [];

  const { data: activePlatforms = [] } = usePlatformsSummary({
    select: (data) => data?.activePlatforms || [],
  });

  const depositsEnabled = safeFind(safeSettings, (s) => s.key === "deposits_enabled")?.value === "true";
  const ticketsActive = safeFind(safeSettings, (s) => s.key === "tickets_box_active")?.value === "true";

  const { data: platformHistory = [] } = useQuery({
    queryKey: ["platform-history", user?.id],
    queryFn: async () => {
      const response = await base44.adminEvents.profile.platformHistory();
      return response.items || [];
    },
    enabled: !!user?.id && !isLoadingAuth && ticketsActive && formExpanded,
    staleTime: 300000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const depositCheckOptions = React.useMemo(() => {
    const map = new Map();

    safeSettings.forEach((entry) => {
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
  }, [activePlatforms, safeSettings]);

  const getSettingValue = (key, defaultValue) => {
    const setting = safeFind(safeSettings, (s) => s.key === key);
    return setting?.value || defaultValue;
  };

  const ticketsBoxTitle = getSettingValue("tickets_box_title", "Ganhe Bilhetes Extras");
  const ticketsGoalAmount = parseFloat(getSettingValue("tickets_goal_amount", "100"));
  const canFillDeposits = depositsEnabled && !!activeCycle?.active;

  const marcos50 = Math.floor(totalApproved / 50);
  const marcos100 = Math.floor(totalApproved / 100);
  const marcos50Puros = marcos50 - marcos100;
  const totalTickets = marcos50Puros * 50 + marcos100 * 100;

  const currentCycleDeposit = totalApproved % ticketsGoalAmount;
  const percentage = (currentCycleDeposit / ticketsGoalAmount) * 100;
  const remainingForNext = ticketsGoalAmount - currentCycleDeposit;
  const isAddingNewPlatform = selectedPlatformKey === ADD_NEW_PLATFORM_VALUE;

  const savedPlatformOptions = React.useMemo(() => {
    const map = new Map();

    platformHistory.forEach((entry) => {
      const normalizedName = String(entry.platform_name || "").trim();
      const normalizedId = String(entry.platform_id || "").trim();
      if (!normalizedName || !normalizedId) return;

      const key = `${normalizedName}|||${normalizedId}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          platform_name: normalizedName,
          platform_id: normalizedId,
        });
      }
    });

    return Array.from(map.values());
  }, [platformHistory]);

  useEffect(() => {
    if (!savedPlatformOptions.length) {
      setSelectedPlatformKey(ADD_NEW_PLATFORM_VALUE);
      return;
    }

    if (selectedPlatformKey === ADD_NEW_PLATFORM_VALUE) {
      return;
    }

    const currentlySelectedExists = savedPlatformOptions.some((item) => item.key === selectedPlatformKey);
    if (currentlySelectedExists) return;

    const nextOption = savedPlatformOptions[0];
    setSelectedPlatformKey(nextOption.key);
    setPlatformName(nextOption.platform_name);
    setPlatformId(nextOption.platform_id);
  }, [savedPlatformOptions, selectedPlatformKey]);

  const handleSelectPlatform = (value) => {
    setSelectedPlatformKey(value);

    if (value === ADD_NEW_PLATFORM_VALUE) {
      setPlatformName("");
      setPlatformId("");
      return;
    }

    const selected = safeFind(savedPlatformOptions, (item) => item.key === value);
    if (!selected) return;
    setPlatformName(selected.platform_name);
    setPlatformId(selected.platform_id);
  };

  useEffect(() => {
    let start = 0;
    const end = Math.min(percentage, 100);
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
  }, [percentage]);

  useEffect(() => {
    const nextUrls = proofImages.map((file) => URL.createObjectURL(file));
    setProofPreviewUrls(nextUrls);

    return () => {
      nextUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [proofImages]);

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
    if (canFillDeposits) return;
    setFormExpanded(false);
  }, [canFillDeposits]);

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

    if (proofImages.length === 0) {
      toast({
        variant: "destructive",
        title: "Comprovante obrigatorio",
        description: "Anexe pelo menos um comprovante do deposito para continuar.",
      });
      return;
    }

    if (!activeCycle?.active) {
      toast({
        variant: "destructive",
        title: activeCycle ? "Ciclo encerrado" : "Sem ciclo ativo",
        description: activeCycle
          ? "O ciclo atual foi encerrado e está aguardando o sorteio dos bilhetes. Novos depósitos não são permitidos."
          : "Aguarde a abertura de um novo ciclo de sorteio.",
      });
      return;
    }

    const minLoadingMs = 3000;
    const startedAt = Date.now();
    setLoading(true);
    setSubmissionStatus("loading");
    setProofUploadError("");
    try {
      const uploadResults = await Promise.allSettled(
        proofImages.map((file) => base44.integrations.Core.UploadFile({ file }))
      );
      const failedUploads = uploadResults.filter((result) => result.status === "rejected");
      if (failedUploads.length > 0) {
        const uploadError = failedUploads[0].reason;
        const uploadMessage = buildProofUploadErrorMessage(uploadError, failedUploads.length);
        setProofUploadError(uploadMessage);
        throw new Error(uploadMessage);
      }
      const fileUrls = uploadResults
        .map((result) => (result.status === "fulfilled" ? result.value?.file_url : ""))
        .filter(Boolean);

      await base44.deposits.create({
        amount: parseFloat(amount),
        platformName,
        userPlatformId: platformId,
        cycleId: activeCycle.id,
        proofImageUrl: fileUrls[0] || "",
        proofImageUrls: fileUrls,
        userName: user.full_name || user.nick,
      });

      const alreadySaved = savedPlatformOptions.some(
        (item) => item.platform_name === platformName.trim() && item.platform_id === platformId.trim()
      );
      if (!alreadySaved) {
        try {
          await base44.entities.PlatformHistory.create({
            user_id: user.id,
            platform_name: platformName.trim(),
            platform_id: platformId.trim(),
            created_at: new Date().toISOString(),
          });
          queryClient.invalidateQueries({ queryKey: ["platform-history", user.id] });
        } catch (historyError) {
          console.error("Erro ao salvar ID da plataforma no histórico:", historyError);
        }
      }

      setAmount("");
      if (isAddingNewPlatform) {
        setPlatformName("");
        setPlatformId("");
      }
      setProofImages([]);
      setProofUploadError("");
      setPreviewImageUrl("");
      setPreviewOpen(false);

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
    } finally {
      setLoading(false);
    }
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

  if (!ticketsActive && !showFormCard) return null;

  return (
    <>
      {showProgressCard ? (
        <Card className={`relative overflow-hidden bg-gradient-to-br from-indigo-900/50 to-purple-900/50 border-indigo-700/50 ${!depositsEnabled ? "opacity-60" : ""}`}>
        {(promoEndDate || activeCycle?.draw_date) ? (
          <div className="absolute top-4 right-4 z-10">
            <CountdownTimer endDateString={activeCycle?.draw_date || promoEndDate} />
          </div>
        ) : null}

        <div className="relative p-5 pt-16">
          <div className="flex items-center gap-2 mb-4">
            <Ticket className="w-6 h-6 text-indigo-400" />
            <h3 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 to-purple-300">
              {ticketsBoxTitle}
            </h3>
          </div>

          <div className="mb-4 rounded-2xl border border-indigo-500/40 bg-gradient-to-br from-indigo-950/70 via-slate-950/50 to-cyan-950/30 p-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-indigo-300/90">Progresso do ciclo</p>
                <p className="text-2xl font-extrabold text-cyan-300">{progress.toFixed(0)}%</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-300">
                  R$ {currentCycleDeposit.toFixed(2)} / R$ {ticketsGoalAmount.toFixed(2)}
                </p>
                <p className="text-sm font-semibold text-yellow-300">{totalTickets} bilhetes gerados</p>
              </div>
            </div>

            <div className="mt-3">
              <div className="relative h-3.5 w-full overflow-hidden rounded-full border border-indigo-500/40 bg-indigo-950/70">
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 via-indigo-400 to-violet-400 transition-all duration-500"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-indigo-200/90">
                <span>Início</span>
                <span>50%</span>
                <span>Meta</span>
              </div>
            </div>
          </div>

          <div className="space-y-2 text-center">
            <div className="px-3 py-2 bg-indigo-900/30 border border-indigo-600/50 rounded-lg">
              <p className="text-sm font-bold text-indigo-200">
                Faltam R$ {remainingForNext.toFixed(2)} para completar a próxima meta de R$ {ticketsGoalAmount.toFixed(2)}
              </p>
            </div>

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
      ) : null}

      {showFormCard ? (
        <Card ref={formCardRef} className="relative bg-gradient-to-br from-slate-900/70 to-slate-800/70 border-slate-700/60 overflow-hidden">
        {submissionStatus !== "idle" ? (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-slate-950/90 px-4 text-center">
            {submissionStatus === "loading" ? (
              <>
                <div className="h-9 w-9 animate-spin rounded-full border-2 border-indigo-300/30 border-t-indigo-300" />
                <p className="text-sm font-semibold text-indigo-100">Registrando deposito...</p>
              </>
            ) : (
              <p className="text-base font-bold text-emerald-300">DEPOSITO REGISTRADO COM SUCESSO</p>
            )}
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => {
            if (!canFillDeposits) {
              toast({
                variant: "destructive",
                title: "Sem ciclo ativo",
                description: "Aguarde a abertura de um novo ciclo para registrar depósitos.",
              });
              return;
            }
            setFormExpanded((prev) => !prev);
          }}
          aria-disabled={!canFillDeposits}
          className="w-full flex items-center justify-between px-4 py-4 text-left"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-indigo-500/40 bg-indigo-500/15">
              <Wallet className="h-4 w-4 text-indigo-300" />
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide">Depósitos</p>
              <h4 className="text-base font-bold text-white">PREENCHER NOVO DEPOSITO</h4>
            </div>
          </div>
          <ChevronDown className={`w-5 h-5 text-slate-300 transition-transform ${formExpanded ? "rotate-180" : ""}`} />
        </button>
        {!isLoadingCycle && activeCycle && !activeCycle.active ? (
          <div className="mx-4 mb-4 rounded-lg border border-amber-600/50 bg-amber-900/30 px-3 py-2">
            <p className="text-xs font-medium text-amber-200">
              O ciclo atual foi encerrado e está aguardando o sorteio dos bilhetes. Novos depósitos estão bloqueados.
            </p>
          </div>
        ) : !activeCycle && !isLoadingCycle ? (
          <div className="mx-4 mb-4 rounded-lg border border-amber-600/50 bg-amber-900/30 px-3 py-2">
            <p className="text-xs font-medium text-amber-200">
              Sem ciclo ativo no momento. O preenchimento de novos depósitos foi bloqueado.
            </p>
          </div>
        ) : null}

        <div
          className={`overflow-hidden border-t border-slate-700/60 transition-all duration-300 ease-in-out ${
            formExpanded ? "max-h-[1100px] opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <div className="px-4 pb-4 pt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tickets-amount" className="text-slate-200">Valor do Deposito (R$)</Label>
              <Input
                id="tickets-amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="bg-slate-900/70 border-slate-700 text-white placeholder:text-slate-500"
                step="0.01"
                min="0"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-200">Plataforma e ID salvos</Label>
              <Select value={selectedPlatformKey} onValueChange={handleSelectPlatform}>
                <SelectTrigger className="bg-slate-900/70 border-slate-700 text-white">
                  <SelectValue placeholder="Selecione um ID salvo" />
                </SelectTrigger>
                <SelectContent>
                  {savedPlatformOptions.map((item) => (
                    <SelectItem key={item.key} value={item.key}>
                      {item.platform_name} - ID {item.platform_id}
                    </SelectItem>
                  ))}
                  <SelectItem value={ADD_NEW_PLATFORM_VALUE}>
                    + Adicionar ID
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isAddingNewPlatform ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="tickets-platformName" className="text-slate-200">Nome da Plataforma</Label>
                  <Input
                    id="tickets-platformName"
                    value={platformName}
                    onChange={(e) => setPlatformName(e.target.value)}
                    placeholder="Ex: PG, Reals, etc"
                    className="bg-slate-900/70 border-slate-700 text-white placeholder:text-slate-500"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tickets-platformId" className="text-slate-200">ID CORRESPONDENTE AO DEPOSITO</Label>
                  <Input
                    id="tickets-platformId"
                    value={platformId}
                    onChange={(e) => setPlatformId(e.target.value)}
                    placeholder="Digite o ID correspondente ao deposito"
                    className="bg-slate-900/70 border-slate-700 text-white placeholder:text-slate-500"
                  />
                </div>
              </>
            ) : (
              <div className="rounded-lg border border-slate-700/80 bg-slate-900/70 px-3 py-2">
                <p className="text-xs text-slate-300">
                  Plataforma: <span className="font-semibold text-white">{platformName || "-"}</span>
                </p>
                <p className="text-xs text-slate-300">
                  ID: <span className="font-mono font-semibold text-white">{platformId || "-"}</span>
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="proof-image" className="text-slate-200">
                Comprovante (selecione todos os comprovantes referentes ao valor do deposito desse ID)
              </Label>
              <Input
                id="proof-image"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                onChange={(e) => {
                  const selected = Array.from(e.target.files || []);
                  if (!selected.length) return;
                  const valid = [];
                  let invalidCount = 0;
                  let oversizedCount = 0;

                  selected.forEach((file) => {
                    const normalizedType = String(file.type || "").toLowerCase();
                    const isSupportedType =
                      (normalizedType && SUPPORTED_IMAGE_MIME_TYPES.has(normalizedType)) ||
                      SUPPORTED_IMAGE_EXTENSIONS.test(String(file.name || ""));
                    if (!isSupportedType) {
                      invalidCount += 1;
                      return;
                    }
                    if (Number(file.size || 0) > MAX_PROOF_IMAGE_SIZE_BYTES) {
                      oversizedCount += 1;
                      return;
                    }
                    if (isSupportedType) {
                      valid.push(file);
                    }
                  });

                  if (invalidCount > 0) {
                    toast({
                      variant: "destructive",
                      title: "Formato não suportado",
                      description: "Use comprovantes em JPG, PNG, WEBP ou GIF.",
                    });
                  }

                  if (oversizedCount > 0) {
                    toast({
                      variant: "destructive",
                      title: "Arquivo muito grande",
                      description: "Cada comprovante deve ter no maximo 40 MB.",
                    });
                  }

                  if (!valid.length) {
                    setProofUploadError("Nenhum comprovante valido foi selecionado. Use uma imagem suportada de ate 40 MB.");
                    e.target.value = "";
                    return;
                  }

                  setProofUploadError("");
                  setProofImages((prev) => {
                    const map = new Map(prev.map((file) => [`${file.name}-${file.size}-${file.lastModified}`, file]));
                    valid.forEach((file) => {
                      map.set(`${file.name}-${file.size}-${file.lastModified}`, file);
                    });
                    return Array.from(map.values());
                  });

                  e.target.value = "";
                }}
                className="h-auto min-h-12 bg-slate-900/70 border-slate-700 py-2 text-white file:mr-3 file:rounded-full file:border-0 file:bg-indigo-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-indigo-500"
              />
              {proofUploadError ? (
                <div className="rounded-lg border border-red-500/40 bg-red-950/40 px-3 py-2 text-xs text-red-200">
                  {proofUploadError}
                </div>
              ) : null}
              {proofImages.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs text-slate-400">Comprovantes selecionados: {proofImages.length}</p>
                  <div className="flex flex-wrap gap-2">
                    {proofPreviewUrls.map((previewUrl, index) => (
                      <div key={previewUrl} className="relative">
                        <button
                          type="button"
                          onClick={() => {
                            setPreviewImageUrl(previewUrl);
                            setPreviewOpen(true);
                          }}
                          className="block overflow-hidden rounded-lg border border-slate-600/80 bg-slate-900/70"
                        >
                          <img
                            src={previewUrl}
                            alt={`Previa do comprovante ${index + 1}`}
                            className="h-24 w-24 object-cover"
                          />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setProofImages((prev) => prev.filter((_, i) => i !== index));
                            if (previewImageUrl === previewUrl) {
                              setPreviewOpen(false);
                              setPreviewImageUrl("");
                            }
                          }}
                          className="absolute -right-1 -top-1 rounded-full bg-red-600 p-1 text-white hover:bg-red-500"
                          aria-label="Remover imagem"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleSubmit}
                disabled={loading || !depositsEnabled || !activeCycle?.active}
                className="flex-1 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-700 hover:to-cyan-700"
              >
                <Upload className="w-4 h-4 mr-2" />
                {loading ? "Enviando comprovante..." : "Registrar"}
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
      ) : null}

      {showFormCard && showCheckMenu ? (
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

      {showFormCard && previewOpen && previewImageUrl ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPreviewOpen(false)}
        >
          <div
            className="relative max-h-[90vh] max-w-[90vw] overflow-hidden rounded-xl border border-slate-700 bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPreviewOpen(false)}
              className="absolute right-2 top-2 z-10 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"
              aria-label="Fechar prévia"
            >
              <X className="h-4 w-4" />
            </button>
            <img
              src={previewImageUrl}
              alt="Comprovante ampliado"
              className="max-h-[90vh] max-w-[90vw] object-contain"
            />
          </div>
        </div>
      ) : null}
    </>
  );
}

