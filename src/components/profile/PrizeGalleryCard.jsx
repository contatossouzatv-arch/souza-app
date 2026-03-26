import React from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { CalendarDays, Check, Clock3, Copy, Gem, Gift, MapPin, ShieldCheck, Sparkles, Trophy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { base44, resolveAssetUrl } from "@/api/base44Client";
import { formatDailyChestPrize, getDailyChestRarityMeta } from "@/lib/dailyChest";
import { toast } from "@/components/ui/use-toast";
import { buildWhatsAppLink } from "@/lib/whatsapp";

function getPrizeIcon(type) {
  const normalized = String(type || "").toLowerCase();
  if (normalized.includes("rank")) return Trophy;
  if (normalized.includes("visual") || normalized.includes("item")) return Gem;
  return Gift;
}

function normalizeSourceLabel(item) {
  const sourceType = String(item?.source_type || item?.metadata?.source_type || "").toLowerCase();
  if (sourceType === "daily_chest") return "Baú Diário";
  if (sourceType === "instant_raffle") return "Sorteio Rápido";
  if (sourceType === "live_draw") return "Sorteio ao Vivo";
  if (sourceType === "game_call") return "Call do Jogo";
  if (sourceType === "deposit_draw") return "Sorteio dos Depositantes";
  if (sourceType === "cashback") return "Cashback";
  return "Premiação do app";
}

function formatDate(value) {
  if (!value) return "Não informado";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatTime(value) {
  if (!value) return "Não informado";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function getValidationCode(item) {
  return (
    item?.metadata?.audit_id ||
    item?.metadata?.opening_id ||
    item?.metadata?.winner_id ||
    item?.source_ref_id ||
    item?.id ||
    "Não informado"
  );
}

function getPrizePrimaryLabel(item) {
  const formattedPrize = formatDailyChestPrize(item);
  if (formattedPrize && formattedPrize !== "0") return formattedPrize;
  return item?.title || "Prêmio";
}

function maskPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "Nao informado";
  if (digits.length <= 4) return `***${digits}`;
  return `*** *** ${digits.slice(-4)}`;
}

function getWinnerName(item, viewer) {
  return (
    item?.metadata?.winner_name ||
    item?.metadata?.user_name ||
    item?.user_name ||
    viewer?.full_name ||
    "Nao informado"
  );
}

function getWinnerPhone(item, viewer) {
  return (
    item?.metadata?.winner_phone ||
    item?.metadata?.user_phone ||
    item?.user_phone ||
    viewer?.phone ||
    ""
  );
}

function getAdminContact(item, raffle = null) {
  const snapshot = item?.metadata?.reward_snapshot || {};
  const fallbackPhone = String(
    item?.metadata?.admin_phone ||
      snapshot?.adminContactPhone ||
      snapshot?.admin_contact_phone ||
      item?.metadata?.telegram_link ||
      raffle?.telegram_link ||
      ""
  ).trim();

  return {
    name: String(
      snapshot?.adminContactName ||
        snapshot?.admin_contact_name ||
        item?.metadata?.admin_name ||
        raffle?.admin_name ||
        ""
    ).trim(),
    phone: fallbackPhone,
  };
}

function isCashPrizeLike(item) {
  const rewardType = String(item?.reward_type || item?.metadata?.reward_snapshot?.rewardType || "").trim().toLowerCase();
  return ["points_balance", "saldo", "bonus", "cash_prize"].includes(rewardType);
}
function PrizeDetailsDialog({ item, viewer, open, onOpenChange }) {
  if (!item) return null;

  const raffleId = String(item?.metadata?.raffle_id || "").trim();
  const isInstantRafflePrize =
    String(item?.source_type || item?.metadata?.source_type || "").toLowerCase() === "instant_raffle";
  const { data: relatedInstantRaffle = null } = useQuery({
    queryKey: ["prize-gallery-instant-raffle", raffleId],
    queryFn: () => base44.instantRaffles.basic(raffleId),
    enabled: open && isInstantRafflePrize && !!raffleId,
    staleTime: 60000,
  });

  const rarity = getDailyChestRarityMeta(item?.rarity);
  const Icon = getPrizeIcon(item?.reward_type);
  const imageUrl = resolveAssetUrl(item?.gallery_image_url || "");
  const sourceLabel = normalizeSourceLabel(item);
  const rewardLabel = getPrizePrimaryLabel(item);
  const claimedAt = item?.claimed_at || item?.created_date || "";
  const winnerName = getWinnerName(item, viewer);
  const winnerPhone = maskPhone(getWinnerPhone(item, viewer));
  const validationCode = String(getValidationCode(item) || "").trim();
  const adminContact = getAdminContact(item, relatedInstantRaffle);
  const showAdminContact = isCashPrizeLike(item) && (adminContact.name || adminContact.phone);
  const requiresAdminRedeem = isCashPrizeLike(item);
  const adminWhatsAppLabel = buildWhatsAppLink(adminContact.phone);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!open) setCopied(false);
  }, [open]);

  const handleCopyCode = React.useCallback(async () => {
    if (!validationCode) return;
    try {
      await navigator.clipboard.writeText(validationCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
      if (!requiresAdminRedeem) {
        toast({
          title: "Codigo copiado",
          description: "Codigo de validacao copiado com sucesso.",
        });
        return;
      }
      toast({
        title: "Codigo copiado",
        description: "Envie esse código ao admin para confirmar o resgate.",
      });
    } catch {
      toast({
        variant: "destructive",
        title: "Não foi possível copiar",
        description: "Tente selecionar o código manualmente.",
      });
    }
  }, [requiresAdminRedeem, validationCode]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88dvh] w-[calc(100vw-1rem)] max-w-md flex-col overflow-hidden border-slate-700 bg-slate-950 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-lg font-black text-white">Detalhes do Prêmio</DialogTitle>
          <DialogDescription className="text-center text-slate-400">
            Informações visíveis apenas para o ganhador.
          </DialogDescription>
        </DialogHeader>

        <div className="hide-scrollbar flex-1 space-y-4 overflow-y-auto pr-1">
          <div className="overflow-hidden rounded-[1.6rem] border border-white/10 bg-slate-900/90">
            <div className={`relative flex h-32 items-center justify-center overflow-hidden bg-gradient-to-br ${rarity.accent}`}>
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.24),transparent_55%)]" />
              {imageUrl ? (
                <img src={imageUrl} alt={item?.title || "Prêmio"} className="relative h-full w-full object-cover" loading="lazy" />
              ) : (
                <Icon className="relative h-12 w-12 text-slate-950" />
              )}
            </div>
            <div className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">GANHOU:</p>
                  <p className="mt-1 text-base font-black text-white">{rewardLabel}</p>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-200">
                  {rarity.label}
                </span>
              </div>
              {item?.subtitle ? <p className="text-xs leading-5 text-slate-400">{item.subtitle}</p> : null}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 text-sm">
            <div className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/5 px-3 py-3">
              <MapPin className="h-4 w-4 text-cyan-300" />
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Onde ganhou</p>
                <p className="font-semibold text-white">{sourceLabel}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/5 px-3 py-3">
              <Sparkles className="h-4 w-4 text-fuchsia-300" />
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Como ganhou</p>
                <p className="font-semibold text-white">{item?.subtitle || item?.title || "Premiação confirmada no app."}</p>
              </div>
            </div>
            {showAdminContact ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/5 px-3 py-3">
                  <ShieldCheck className="h-4 w-4 text-emerald-300" />
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">ADM responsavel</p>
                    <p className="truncate font-semibold text-white">{adminContact.name || "Nao informado"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/5 px-3 py-3">
                  <ShieldCheck className="h-4 w-4 text-cyan-300" />
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Telefone do ADM</p>
                    <p className="truncate font-semibold text-white">{adminContact.phone || "Nao informado"}</p>
                  </div>
                </div>
                {adminWhatsAppLabel ? (
                  <a
                    href={adminWhatsAppLabel}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-3 text-sm font-bold text-emerald-200 transition hover:bg-emerald-500/20 sm:col-span-2"
                  >
                    Chamar no WhatsApp
                  </a>
                ) : null}
              </div>
            ) : null}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/5 px-3 py-3">
                <Trophy className="h-4 w-4 text-emerald-300" />
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Ganhador</p>
                  <p className="truncate font-semibold text-white">{winnerName}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/5 px-3 py-3">
                <ShieldCheck className="h-4 w-4 text-cyan-300" />
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Telefone para confirmação</p>
                  <p className="truncate font-semibold text-white">{winnerPhone}</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/5 px-3 py-3">
                <CalendarDays className="h-4 w-4 text-emerald-300" />
                <div>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Data</p>
                  <p className="font-semibold text-white">{formatDate(claimedAt)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/5 px-3 py-3">
                <Clock3 className="h-4 w-4 text-amber-300" />
                <div>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Hora</p>
                  <p className="font-semibold text-white">{formatTime(claimedAt)}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/5 px-3 py-3">
              <ShieldCheck className="h-4 w-4 text-cyan-300" />
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Código de validação</p>
                <div className="mt-1 flex items-center gap-2">
                  <div className="hide-scrollbar min-w-0 flex-1 overflow-x-auto rounded-lg border border-white/8 bg-slate-900/70 px-2 py-1">
                    <p className="select-all whitespace-nowrap font-semibold text-white">{validationCode}</p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleCopyCode}
                    className="h-8 rounded-xl bg-cyan-400 px-2.5 text-slate-950 hover:bg-cyan-300"
                  >
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function PrizeGalleryCard({
  userId,
  title = "Galeria de Prêmios",
  subtitle = "Recompensas já ganhas no app.",
  emptyTitle = "Sua galeria ainda está vazia",
  emptySubtitle = "Abra o Baú Diário e os próximos prêmios vão aparecer aqui automaticamente.",
  countLabel = "ganhos",
  privateView = false,
}) {
  const previewBatchSize = 3;
  const galleryBatchSize = 12;
  const [selectedItem, setSelectedItem] = React.useState(null);
  const [isGalleryOpen, setIsGalleryOpen] = React.useState(false);

  const { data: previewResponse = null, isLoading: isLoadingPreview } = useQuery({
    queryKey: ["user-prize-gallery-preview", userId],
    queryFn: () => base44.gamification.prizeGallery({ userId, limit: previewBatchSize, offset: 0 }),
    enabled: Boolean(userId),
    staleTime: 30000,
  });
  const { data: viewer = null } = useQuery({
    queryKey: ["prize-gallery-viewer"],
    queryFn: () => base44.auth.me(),
    enabled: Boolean(privateView),
    staleTime: 60000,
  });
  const {
    data: pagedGallery = null,
    isLoading: isLoadingGallery,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: ["user-prize-gallery-pages", userId],
    queryFn: ({ pageParam = 0 }) => base44.gamification.prizeGallery({ userId, limit: galleryBatchSize, offset: pageParam }),
    enabled: Boolean(userId) && isGalleryOpen,
    initialPageParam: 0,
    staleTime: 30000,
    getNextPageParam: (lastPage) => (lastPage?.hasMore ? lastPage.nextOffset : undefined),
  });

  const items = previewResponse?.items || [];
  const totalItems = Number(previewResponse?.total || 0);
  const visibleItems = items.slice(0, previewBatchSize);
  const hiddenCount = Math.max(0, totalItems - visibleItems.length);
  const galleryItems = React.useMemo(
    () => pagedGallery?.pages?.flatMap((page) => page?.items || []) || [],
    [pagedGallery]
  );
  const totalGalleryItems = Number(pagedGallery?.pages?.[0]?.total || totalItems || 0);
  const remainingGalleryItems = Math.max(0, totalGalleryItems - galleryItems.length);

  const handleGalleryScroll = React.useCallback((event) => {
    const element = event.currentTarget;
    const distanceToBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    if (distanceToBottom > 160) return;
    if (!hasNextPage || isFetchingNextPage) return;
    fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const renderPrizeCard = (item) => {
    const rarity = getDailyChestRarityMeta(item?.rarity);
    const Icon = getPrizeIcon(item?.reward_type);
    const imageUrl = resolveAssetUrl(item?.gallery_image_url || "");
    const rewardLabel = getPrizePrimaryLabel(item);
    const content = (
      <div className="overflow-hidden rounded-[1.45rem] border border-white/8 bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.92))] shadow-[0_20px_40px_rgba(2,6,23,0.38)] transition hover:border-cyan-400/30 hover:shadow-[0_22px_50px_rgba(8,145,178,0.18)]">
        <div className={`relative flex h-24 items-center justify-center overflow-hidden bg-gradient-to-br ${rarity.accent}`}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.24),transparent_55%)]" />
          {imageUrl ? (
            <img src={imageUrl} alt={item?.title || "Prêmio"} className="relative h-full w-full object-cover" loading="lazy" />
          ) : (
            <Icon className="relative h-10 w-10 text-slate-950" />
          )}
        </div>
        <div className="space-y-2 p-3 text-center">
          <div className="flex justify-center">
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.16em] text-slate-200">
              {rarity.label}
            </span>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">GANHOU:</p>
            <p className="line-clamp-2 min-h-[2.5rem] text-sm font-black leading-5 text-white">
              {rewardLabel || "Prêmio"}
            </p>
          </div>
          {privateView ? <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Toque para ver detalhes</p> : null}
        </div>
      </div>
    );

    if (!privateView) {
      return <div key={item.id}>{content}</div>;
    }

    return (
      <button
        key={item.id}
        type="button"
        onClick={() => setSelectedItem(item)}
        className="text-left"
        aria-label={`Abrir detalhes do prêmio ${item?.title || rewardLabel || "prêmio"}`}
      >
        {content}
      </button>
    );
  };

  return (
    <>
      <Card className="border-slate-800 bg-slate-900/70 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">{title}</h2>
            <p className="mt-1 text-xs text-slate-400">{subtitle}</p>
          </div>
          <div className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-[11px] font-bold text-cyan-200">
            {totalItems} {countLabel}
          </div>
        </div>

        {isLoadingPreview ? (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Array.from({ length: previewBatchSize }).map((_, index) => (
              <div key={`prize-gallery-preview-skeleton-${index}`} className="overflow-hidden rounded-[1.45rem] border border-white/8 bg-slate-900/80">
                <div className="h-24 animate-pulse bg-slate-800/90" />
                <div className="space-y-2 p-3">
                  <div className="mx-auto h-4 w-16 animate-pulse rounded-full bg-slate-800/90" />
                  <div className="space-y-1">
                    <div className="h-3 w-full animate-pulse rounded bg-slate-800/90" />
                    <div className="h-3 w-3/4 animate-pulse rounded bg-slate-800/90" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : totalItems === 0 ? (
          <div className="mt-4 rounded-3xl border border-dashed border-slate-700 bg-slate-950/60 p-5 text-center">
            <Sparkles className="mx-auto h-8 w-8 text-cyan-300/70" />
            <p className="mt-3 text-sm font-semibold text-white">{emptyTitle}</p>
            <p className="mt-1 text-xs leading-5 text-slate-400">{emptySubtitle}</p>
          </div>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {visibleItems.map(renderPrizeCard)}
            </div>
            {hiddenCount > 0 ? (
              <button
                type="button"
                onClick={() => setIsGalleryOpen(true)}
                className="mt-3 flex w-full items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-3 text-sm font-bold text-cyan-200 transition hover:border-cyan-300/40 hover:bg-cyan-500/15"
              >
                Ver todos os prêmios (+{hiddenCount})
              </button>
            ) : null}
          </>
        )}
      </Card>

      <Dialog open={isGalleryOpen} onOpenChange={setIsGalleryOpen}>
        <DialogContent className="border-slate-700 bg-slate-950 text-white sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-center text-lg font-black text-white">{title}</DialogTitle>
            <DialogDescription className="text-center text-slate-400">
              Coleção completa dos prêmios confirmados nesta conta.
            </DialogDescription>
          </DialogHeader>
          <div className="hide-scrollbar max-h-[70vh] overflow-y-auto pr-1" onScroll={handleGalleryScroll}>
            {isLoadingGallery && galleryItems.length === 0 ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 text-center text-sm text-slate-300">
                Carregando sua galeria...
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {galleryItems.map(renderPrizeCard)}
            </div>
            {isFetchingNextPage ? (
              <div className="pt-4 text-center text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                Carregando mais prêmios...
              </div>
            ) : null}
            {remainingGalleryItems > 0 ? (
              <div className="pt-4 text-center text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                Role para carregar mais prêmios ({remainingGalleryItems} restantes)
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <PrizeDetailsDialog item={selectedItem} viewer={viewer} open={Boolean(selectedItem)} onOpenChange={(open) => !open && setSelectedItem(null)} />
    </>
  );
}
