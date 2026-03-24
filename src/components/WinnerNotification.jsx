import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy, ExternalLink, Check, Calendar } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { useAppSettings } from "@/hooks/useAppSettings";

export default function WinnerNotification({ userId }) {
  const queryClient = useQueryClient();

  const { data: winnings = [] } = useQuery({
    queryKey: ["my-winnings", userId],
    queryFn: () =>
      base44.entities.LiveDrawParticipant.filter({
        user_id: userId,
        validated: true,
        won: true,
      }),
  });

  const { data: depositantWinnings = [] } = useQuery({
    queryKey: ["my-depositant-winnings", userId],
    queryFn: () =>
      base44.entities.DepositantDrawWinner.filter({
        user_id: userId,
        prize_type: "raffle",
      }),
  });

  const { data: settings = [] } = useAppSettings();

  const { data: raffles = [] } = useQuery({
    queryKey: ["winner-raffles"],
    queryFn: () => base44.entities.LiveDrawRaffle.list(),
  });

  const updateParticipantMutation = useMutation({
    mutationFn: (participantId) => base44.winnings.claim("live-draw", participantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-winnings"] });
    },
  });

  const updateDepositantMutation = useMutation({
    mutationFn: (winnerId) => base44.winnings.claim("deposit-draw", winnerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-depositant-winnings"] });
    },
  });

  const activeWinning = winnings.find((w) => !w.claimed_at);
  const activeDepositantWinning = depositantWinnings.find((w) => !w.claimed_at);

  if (!activeWinning && !activeDepositantWinning) return null;

  const currentWinning = activeDepositantWinning || activeWinning;
  const isDepositantWinning = Boolean(activeDepositantWinning);

  const raffle = isDepositantWinning
    ? null
    : raffles.find((r) => r.id === currentWinning?.raffle_id);

  const prizeAmount = Number(
    isDepositantWinning
      ? currentWinning?.prize_amount
      : currentWinning?.prize_amount || raffle?.prize_amount || 0
  );

  const raffleTitle = isDepositantWinning
    ? "Sorteio dos Depositantes"
    : raffle?.title || "Sorteio ao Vivo";
  const adminName = isDepositantWinning
    ? "Admin responsavel"
    : String(raffle?.admin_name || "").trim();
  const whatsappRedeemLink = buildWhatsAppLink(
    isDepositantWinning
      ? settings.find((s) => s.key === "cashback_redeem_link")?.value
      : raffle?.admin_phone
  );

  const winDateRaw =
    currentWinning?.draw_date ||
    currentWinning?.updated_date ||
    currentWinning?.created_date;

  const parsedDate = winDateRaw ? new Date(winDateRaw) : null;
  const winDateLabel =
    parsedDate && !Number.isNaN(parsedDate.getTime())
      ? format(parsedDate, "dd/MM/yyyy HH:mm:ss")
      : "Data indisponível";

  const handleClaimed = () => {
    if (!currentWinning?.id) return;
    if (isDepositantWinning) {
      updateDepositantMutation.mutate(currentWinning.id);
    } else {
      updateParticipantMutation.mutate(currentWinning.id);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -50, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -50, scale: 0.9 }}
        transition={{ duration: 0.5, type: "spring" }}
      >
        <Card className="relative overflow-hidden bg-gradient-to-br from-yellow-900/50 to-orange-900/50 border-4 border-yellow-500 animate-pulse shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-r from-yellow-400/20 to-orange-400/20 animate-pulse" />

          <div className="relative p-4 md:p-6 text-center">
            <motion.div
              animate={{ rotate: [0, 10, -10, 10, 0] }}
              transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
            >
              <Trophy className="w-16 md:w-20 h-16 md:h-20 text-yellow-400 mx-auto mb-4" />
            </motion.div>

            <h2 className="text-2xl md:text-3xl font-bold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-orange-300 to-yellow-300">
              PARABÉNS! VOCÊ GANHOU!
            </h2>

            <div className="mb-4">
              <p className="text-lg md:text-xl font-bold text-yellow-200 mb-1">{raffleTitle}</p>
              {isDepositantWinning && currentWinning?.ticket_numbers?.[0] && (
                <p className="text-sm text-cyan-300 mb-2">
                  Bilhete Sorteado: #{currentWinning.ticket_numbers[0]}
                </p>
              )}
              <p className="text-3xl md:text-4xl font-bold text-green-400">R$ {prizeAmount.toFixed(2)}</p>
            </div>

            <div className="mb-4 p-3 bg-purple-900/50 border border-purple-600/50 rounded-lg">
              <div className="flex items-center justify-center gap-2 text-purple-200 text-sm">
                <Calendar className="w-4 h-4" />
                <span>Premiado em: {winDateLabel}</span>
              </div>
            </div>

            <div className="mb-6 p-3 md:p-4 bg-purple-900/50 border border-purple-600/50 rounded-lg">
              <p className="text-xs md:text-sm text-purple-200 mb-2">
                Para resgatar seu prêmio, entre em contato {adminName ? `com ${adminName}` : "com o admin"} via WhatsApp:
              </p>
              {whatsappRedeemLink ? (
                <a
                  href={whatsappRedeemLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold transition-all text-sm md:text-base"
                >
                  <ExternalLink className="w-4 h-4" />
                  Falar no WhatsApp
                </a>
              ) : (
                <span className="inline-flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg font-bold text-sm md:text-base">
                  <ExternalLink className="w-4 h-4" />
                  WhatsApp indisponível
                </span>
              )}
            </div>

            <Button
              onClick={handleClaimed}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-base md:text-lg font-bold py-4 md:py-6"
            >
              <Check className="w-5 h-5 mr-2" />
              JÁ RESGATEI MEU PRÊMIO
            </Button>
          </div>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}
