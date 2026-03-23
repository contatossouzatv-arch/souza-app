import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44, resolveAssetUrl } from "@/api/base44Client";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import DepositProgress from "@/components/DepositProgress";
import DepositHistory from "@/components/DepositHistory";
import TicketsProgressBox from "@/components/TicketsProgressBox";
import TicketsDisplay from "@/components/TicketsDisplay";
import PlatformSelector from "@/components/PlatformSelector";
import TechLoader from "@/components/TechLoader";
import CountdownTimer from "@/components/CountdownTimer";
import { ChevronDown, Trophy } from "lucide-react";
import { createPageUrl } from "@/utils";
import bannerSorteio from "../../assets-para-app/banner sorteio.png";
import LegalLinksBar from "@/components/LegalLinksBar";
import { useAuth } from "@/lib/AuthContext";

const avatarModules = import.meta.glob("../../assets-para-app/avatar/*.png", {
  eager: true,
  import: "default",
});

const avatarOptions = Object.entries(avatarModules)
  .map(([path, src]) => ({
    id: path.split("/").pop().replace(".png", ""),
    src,
  }))
  .sort((a, b) => a.id.localeCompare(b.id));

const DEFAULT_AVATAR_ID =
  avatarOptions.find((item) => item.id.toLowerCase().includes("avatar padrao perfil sem foto"))?.id ||
  avatarOptions[0]?.id ||
  "";

export default function Deposits() {
  const navigate = useNavigate();
  const { user, isLoadingAuth } = useAuth();
  const [historyPopup, setHistoryPopup] = useState(null);
  const [expandedHistoryCycle, setExpandedHistoryCycle] = useState(null);

  const { data: deposits = [], refetch: refetchDeposits, isLoading: depositsLoading } = useQuery({
    queryKey: ["deposits", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const response = await base44.deposits.my();
      return response.items || [];
    },
    enabled: !!user,
    staleTime: 30000,
  });

  const { data: allDeposits = [], isLoading: allDepositsLoading } = useQuery({
    queryKey: ["all-deposits"],
    queryFn: async () => {
      if (user?.role === "admin") {
        const response = await base44.deposits.adminList();
        return response.items || [];
      }
      return [];
    },
    enabled: !!user,
    staleTime: 30000,
  });

  const { data: allUsers = [], isLoading: usersLoading } = useQuery({
    queryKey: ["all-users-top3"],
    queryFn: () => base44.entities.User.list(),
    enabled: !!user,
    staleTime: 60000,
  });

  const { data: settings = [], isLoading: settingsLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: () => base44.entities.AppSettings.list(),
    enabled: !!user,
    staleTime: 300000,
  });

  const { data: cycles = [] } = useQuery({
    queryKey: ["deposit-cycles-dashboard"],
    queryFn: () => base44.entities.DepositantDrawCycle.list("-created_date"),
    enabled: !!user,
    staleTime: 60000,
  });

  const { data: drawWinners = [], isLoading: drawWinnersLoading } = useQuery({
    queryKey: ["depositant-draw-winners-history"],
    queryFn: () => base44.entities.DepositantDrawWinner.list("-draw_date"),
    enabled: !!user,
    staleTime: 60000,
  });
  const activeCycle = cycles.find((c) => c.active);

  const { data: leaderboard = [], isLoading: leaderboardLoading } = useQuery({
    queryKey: ["deposit-cycle-leaderboard", activeCycle?.id],
    queryFn: async () => {
      const response = await base44.deposits.leaderboard({ cycleId: activeCycle?.id, limit: 20 });
      return response.items || [];
    },
    enabled: !!user && !!activeCycle?.id,
    staleTime: 30000,
  });

  const cycleApprovedDeposits = deposits.filter(
    (d) => d.status === "approved" && d.cycle_id === activeCycle?.id
  );
  const cyclePendingDeposits = deposits.filter(
    (d) => d.status === "pending" && d.cycle_id === activeCycle?.id
  );

  const totalApproved = cycleApprovedDeposits.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
  const pendingAmount = cyclePendingDeposits.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
  const myBasicTickets = cycleApprovedDeposits.reduce((sum, d) => sum + Number(d.basic_ticket_count || 0), 0);
  const myBonusTickets = cycleApprovedDeposits.reduce((sum, d) => sum + Number(d.bonus_ticket_count || 0), 0);
  const myTotalTickets = cycleApprovedDeposits.reduce(
    (sum, d) => sum + Number(d.tickets_count || d.ticket_numbers?.length || 0),
    0
  );

  const rankings = leaderboard;
  const top3 = rankings.slice(0, 3);
  const userPosition = rankings.findIndex((u) => u.user_id === user?.id) + 1;

  const getSettingValue = (key, defaultValue = "") => {
    const setting = settings.find((s) => s.key === key);
    return setting?.value || defaultValue;
  };

  const cashbackEndDate = getSettingValue("cashback_end_date");
  const depositantDrawEndDate = activeCycle?.draw_date || getSettingValue("depositant_draw_end_date");

  const isLoading =
    isLoadingAuth ||
    !user ||
    depositsLoading ||
    allDepositsLoading ||
    settingsLoading ||
    usersLoading ||
    drawWinnersLoading ||
    (Boolean(activeCycle?.id) && leaderboardLoading);

  if (isLoading) {
    return <TechLoader />;
  }

  const usersById = {};
  allUsers.forEach((u) => {
    usersById[u.id] = u;
  });

  const getWinnerProfile = (winner) => {
    if (!winner) return null;
    const profile = usersById[winner.user_id];
    const defaultAvatar =
      avatarOptions.find((item) => item.id === DEFAULT_AVATAR_ID) ||
      avatarOptions[0];
    const displayName = profile?.full_name || winner.user_name || "Participante";
    const nickValue = profile?.nick || "";
    const handle = nickValue ? `@${nickValue}` : "";
    const avatarSrc =
      profile?.profile_image_mode === "photo" &&
      profile?.profile_image_status === "approved" &&
      profile?.profile_image_url
        ? resolveAssetUrl(profile.profile_image_url)
        : defaultAvatar?.src || "";
    const avatarFallback = profile?.avatar_emoji || displayName.charAt(0).toUpperCase();

    return {
      userId: profile?.id || winner.user_id || "",
      displayName,
      handle,
      avatarSrc,
      defaultAvatarSrc: defaultAvatar?.src || "",
      avatarFallback,
    };
  };

  const openWinnerProfile = (winner) => {
    if (winner?.user_id && winner.user_id === user?.id) {
      navigate(createPageUrl("Profile"));
      return;
    }

    const profile = getWinnerProfile(winner);
    if (!profile) return;
    if (profile.userId) {
      navigate(`${createPageUrl("Profile")}?user=${encodeURIComponent(profile.userId)}`);
      return;
    }
    const rawHandle = profile.handle?.replace(/^@/, "") || "";
    if (rawHandle) {
      navigate(`${createPageUrl("Profile")}?u=${encodeURIComponent(rawHandle)}`);
      return;
    }
    if (winner?.user_id) {
      navigate(`${createPageUrl("Profile")}?user=${encodeURIComponent(winner.user_id)}`);
    }
  };

  const endedCycles = cycles.filter((c) => !c.active);

  const getCycleTop3 = (cycleId) => {
    const cycleRankingMap = {};
    allDeposits
      .filter((d) => d.status === "approved" && d.cycle_id === cycleId)
      .forEach((d) => {
        if (!cycleRankingMap[d.user_id]) {
          cycleRankingMap[d.user_id] = { user_id: d.user_id, total: 0 };
        }
        cycleRankingMap[d.user_id].total += parseFloat(d.amount) || 0;
      });

    return Object.values(cycleRankingMap)
      .sort((a, b) => b.total - a.total)
      .slice(0, 3);
  };

  const getCycleDrawWinners = (cycle) => {
    const newFormat = drawWinners.filter((w) => w.cycle_id === cycle.id);
    if (newFormat.length > 0) return newFormat.slice(0, 5);
    if (Array.isArray(cycle.raffle_winners) && cycle.raffle_winners.length > 0) {
      return cycle.raffle_winners.slice(0, 5);
    }
    return [];
  };

  const getUserCycleData = (cycleId) => {
    const cycleUserDeposits = deposits.filter(
      (d) => d.cycle_id === cycleId && (d.status === "approved" || d.status === "pending")
    );

    const cycleApprovedDeposits = cycleUserDeposits.filter((d) => d.status === "approved");
    const totalDeposited = cycleApprovedDeposits.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
    const totalTickets = cycleApprovedDeposits.reduce(
      (sum, d) => sum + Number(d.tickets_count || d.ticket_numbers?.length || 0),
      0
    );

    return {
      all: cycleUserDeposits,
      approved: cycleApprovedDeposits,
      totalDeposited,
      totalTickets,
    };
  };

  const getUserCycleTickets = (cycleId) => {
    const cycleUserApproved = deposits.filter(
      (d) => d.cycle_id === cycleId && d.status === "approved"
    );
    return cycleUserApproved.flatMap((d) =>
      Array.isArray(d.ticket_numbers) ? d.ticket_numbers : []
    );
  };

  const getParticipantProfileData = (entry) => {
    const profile = usersById[entry?.user_id];
    const defaultAvatar =
      avatarOptions.find((item) => item.id === DEFAULT_AVATAR_ID) || avatarOptions[0];
    const displayName = profile?.full_name || entry?.user_name || "Participante";
    const nickValue = profile?.nick || entry?.user_nick || "";
    const handle = nickValue ? `@${nickValue}` : "";
    const avatarSrc =
      profile?.profile_image_mode === "photo" &&
      profile?.profile_image_status === "approved" &&
      profile?.profile_image_url
        ? resolveAssetUrl(profile.profile_image_url)
        : defaultAvatar?.src || "";
    const avatarFallback = profile?.avatar_emoji || entry?.user_avatar || displayName.charAt(0).toUpperCase();

    return { displayName, handle, avatarSrc, avatarFallback, defaultAvatarSrc: defaultAvatar?.src || "" };
  };

  return (
    <motion.div
      className="space-y-4"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="rounded-2xl border border-slate-800 bg-gradient-to-r from-cyan-500/15 to-slate-900 px-4 py-4">
        <h1 className="text-lg font-bold">Área de Depósitos</h1>
        <p className="text-sm text-slate-400">Tudo separado em uma tela só para depósito e bilhetes.</p>
      </div>

      <Card className="overflow-hidden border-slate-800 bg-slate-900/60 p-0">
        <img
          src={bannerSorteio}
          alt="Banner sorteio"
          className="h-40 w-full object-cover object-top sm:h-48"
        />
      </Card>

      <PlatformSelector />

      <TicketsProgressBox
        totalApproved={totalApproved}
        pendingAmount={pendingAmount}
        user={user}
        onDepositSubmit={refetchDeposits}
        promoEndDate={depositantDrawEndDate}
        activeCycle={activeCycle}
        showProgressCard={false}
      />

      <Card className="border-cyan-500/40 bg-gradient-to-br from-cyan-950/45 via-slate-900 to-indigo-950/35 p-4 shadow-[0_10px_30px_rgba(6,182,212,0.18)]">
        <div className="mb-4 flex items-center justify-center gap-2">
          <Trophy className="h-5 w-5 text-cyan-300" />
          <h2 className="text-sm font-bold uppercase tracking-wide text-cyan-200">Sorteio dos Depositantes</h2>
        </div>

        {!activeCycle ? (
          <div className="rounded-lg border border-cyan-600/40 bg-cyan-900/20 px-3 py-5 text-center">
            <p className="text-sm font-bold text-cyan-200">AGUARDANDO NOVO CICLO</p>
            <p className="mt-1 text-xs text-cyan-100/80">
              Assim que um novo ciclo for iniciado no painel, os dados aparecem aqui.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-4 space-y-2">
              <h4 className="text-center text-xs font-bold uppercase tracking-wide text-slate-300">Top 3 Atual</h4>
              <div className="grid grid-cols-3 gap-2">
            <div className="min-w-0 rounded-lg border border-yellow-600/50 bg-yellow-900/30 p-3 text-center">
              <div className="text-xs font-bold text-yellow-300">Premio de R$ 500</div>
              {top3[0] ? (
                <button
                  type="button"
                  onClick={() => openWinnerProfile(top3[0])}
                  className="mt-2 flex min-w-0 w-full flex-col items-center gap-1 rounded-md px-1 py-1 transition hover:bg-yellow-700/20"
                >
                  {getWinnerProfile(top3[0])?.avatarSrc ? (
                    <img
                      src={getWinnerProfile(top3[0])?.avatarSrc}
                      alt={getWinnerProfile(top3[0])?.displayName}
                      className="h-9 w-9 rounded-full border border-yellow-300/70 object-cover"
                      onError={(event) => {
                        event.currentTarget.src = getWinnerProfile(top3[0])?.defaultAvatarSrc || "";
                      }}
                    />
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-full border border-yellow-300/70 bg-yellow-700/40 text-sm">
                      {getWinnerProfile(top3[0])?.avatarFallback}
                    </div>
                  )}
                  <p className="w-full truncate text-[11px] font-semibold text-yellow-100">{getWinnerProfile(top3[0])?.displayName}</p>
                  {getWinnerProfile(top3[0])?.handle ? (
                    <p className="w-full truncate text-[10px] text-yellow-200/90">{getWinnerProfile(top3[0]).handle}</p>
                  ) : null}
                </button>
              ) : null}
            </div>
            <div className="min-w-0 rounded-lg border border-gray-500/50 bg-gray-700/30 p-3 text-center">
              <div className="text-xs font-bold text-gray-300">Premio de R$ 300</div>
              {top3[1] ? (
                <button
                  type="button"
                  onClick={() => openWinnerProfile(top3[1])}
                  className="mt-2 flex min-w-0 w-full flex-col items-center gap-1 rounded-md px-1 py-1 transition hover:bg-slate-600/20"
                >
                  {getWinnerProfile(top3[1])?.avatarSrc ? (
                    <img
                      src={getWinnerProfile(top3[1])?.avatarSrc}
                      alt={getWinnerProfile(top3[1])?.displayName}
                      className="h-9 w-9 rounded-full border border-gray-300/70 object-cover"
                      onError={(event) => {
                        event.currentTarget.src = getWinnerProfile(top3[1])?.defaultAvatarSrc || "";
                      }}
                    />
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-300/70 bg-gray-700/50 text-sm">
                      {getWinnerProfile(top3[1])?.avatarFallback}
                    </div>
                  )}
                  <p className="w-full truncate text-[11px] font-semibold text-gray-100">{getWinnerProfile(top3[1])?.displayName}</p>
                  {getWinnerProfile(top3[1])?.handle ? (
                    <p className="w-full truncate text-[10px] text-gray-200/90">{getWinnerProfile(top3[1]).handle}</p>
                  ) : null}
                </button>
              ) : null}
            </div>
            <div className="min-w-0 rounded-lg border border-orange-600/50 bg-orange-900/30 p-3 text-center">
              <div className="text-xs font-bold text-orange-300">Premio de R$ 200</div>
              {top3[2] ? (
                <button
                  type="button"
                  onClick={() => openWinnerProfile(top3[2])}
                  className="mt-2 flex min-w-0 w-full flex-col items-center gap-1 rounded-md px-1 py-1 transition hover:bg-orange-700/20"
                >
                  {getWinnerProfile(top3[2])?.avatarSrc ? (
                    <img
                      src={getWinnerProfile(top3[2])?.avatarSrc}
                      alt={getWinnerProfile(top3[2])?.displayName}
                      className="h-9 w-9 rounded-full border border-orange-300/70 object-cover"
                      onError={(event) => {
                        event.currentTarget.src = getWinnerProfile(top3[2])?.defaultAvatarSrc || "";
                      }}
                    />
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-full border border-orange-300/70 bg-orange-700/40 text-sm">
                      {getWinnerProfile(top3[2])?.avatarFallback}
                    </div>
                  )}
                  <p className="w-full truncate text-[11px] font-semibold text-orange-100">{getWinnerProfile(top3[2])?.displayName}</p>
                  {getWinnerProfile(top3[2])?.handle ? (
                    <p className="w-full truncate text-[10px] text-orange-200/90">{getWinnerProfile(top3[2]).handle}</p>
                  ) : null}
                </button>
              ) : null}
            </div>
          </div>
            <div className="rounded-lg border border-indigo-600/50 bg-indigo-900/30 p-2 text-center">
              <p className="text-xs text-indigo-200">+ 5 sorteios de R$ 200 entre todos os participantes</p>
            </div>
            {depositantDrawEndDate ? (
              <div className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 p-3 text-center">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-200">
                  CONTAGEM PARA O FIM DO CICLO!
                </p>
                <div className="flex items-center justify-center">
                  <CountdownTimer endDateString={depositantDrawEndDate} />
                </div>
              </div>
            ) : null}
          </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <div className="flex min-h-[110px] flex-col items-center justify-center rounded-xl border border-cyan-500/35 bg-gradient-to-br from-cyan-950/60 to-cyan-900/20 p-3 text-center">
                <p className="text-xs text-cyan-200">Sua Posicao</p>
                <p className="text-2xl font-black text-cyan-300">#{userPosition || "-"}</p>
              </div>
              <div className="flex min-h-[110px] flex-col items-center justify-center rounded-xl border border-indigo-500/35 bg-gradient-to-br from-indigo-950/60 to-indigo-900/20 p-3 text-center">
                <p className="text-xs text-indigo-200">Total Depositado</p>
                <p className="text-xl font-bold text-indigo-300">R$ {totalApproved.toFixed(2)}</p>
              </div>
              <div className="col-span-2 flex min-h-[110px] flex-col items-center justify-center rounded-xl border border-emerald-500/35 bg-gradient-to-br from-emerald-950/60 to-emerald-900/20 p-3 text-center md:col-span-1">
                <p className="text-xs text-green-200">Total de Bilhetes</p>
                <p className="text-2xl font-black text-green-300">{myTotalTickets}</p>
                <p className="text-xs text-green-200">
                  ({myBasicTickets} + {myBonusTickets} bonus)
                </p>
              </div>
            </div>
          </>
        )}
      </Card>

      <DepositProgress
        totalApproved={totalApproved}
        pendingAmount={pendingAmount}
        user={user}
        onDepositSubmit={refetchDeposits}
        promoEndDate={cashbackEndDate}
        activeCycle={activeCycle}
      />

      <DepositHistory />

      <TicketsDisplay
        deposits={deposits}
        allDeposits={allDeposits}
        currentUserId={user?.id}
        promoEndDate={depositantDrawEndDate}
        showSummaryInCard={false}
      />

      <Card className="border-purple-500/35 bg-gradient-to-br from-purple-950/50 via-slate-900 to-indigo-950/40 p-4 shadow-[0_10px_30px_rgba(147,51,234,0.18)]">
        <div className="mb-4 flex items-center justify-center gap-2">
          <Trophy className="h-5 w-5 text-purple-300" />
          <h2 className="text-sm font-bold uppercase tracking-wide text-purple-200">Histórico de Participações</h2>
        </div>

        {endedCycles.length === 0 ? (
          <div className="rounded-lg border border-slate-700 bg-slate-900/40 px-3 py-4 text-center text-sm text-slate-300">
            Nenhum ciclo encerrado ainda.
          </div>
        ) : (
          <div className="space-y-3">
            {endedCycles.map((cycle) => {
              const cycleTop3 = getCycleTop3(cycle.id);
              const cycleWinners = getCycleDrawWinners(cycle);
              const myCycleData = getUserCycleData(cycle.id);
              const isExpanded = expandedHistoryCycle === cycle.id;

              return (
                <div key={cycle.id} className="rounded-xl border border-slate-700/80 bg-slate-900/45 p-3">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedHistoryCycle((prev) => (prev === cycle.id ? null : cycle.id))
                    }
                    className="flex w-full items-center justify-between rounded-lg border border-purple-700/35 bg-purple-900/20 px-3 py-2 text-left"
                  >
                    <p className="text-xs font-bold uppercase tracking-wide text-purple-200">
                      Ciclo #{cycle.cycle_number}
                    </p>
                    <ChevronDown
                      className={`h-4 w-4 text-purple-200 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    />
                  </button>

                  {isExpanded ? (
                    <>
                      <div className="mt-3 grid grid-cols-3 gap-2">
                    {["R$ 500", "R$ 300", "R$ 200"].map((label, idx) => {
                      const entry = cycleTop3[idx];
                      const profile = entry ? getParticipantProfileData(entry) : null;

                      return (
                        <div key={`${cycle.id}-top-${idx}`} className="rounded-lg border border-purple-700/40 bg-purple-900/20 p-2 text-center">
                          <p className="text-[10px] font-semibold text-purple-200">{label}</p>
                          {profile ? (
                            <button
                              type="button"
                              onClick={() => openWinnerProfile(entry)}
                              className="mt-1 flex w-full flex-col items-center gap-1"
                            >
                              {profile.avatarSrc ? (
                                <img
                                  src={profile.avatarSrc}
                                  alt={profile.displayName}
                                  className="h-8 w-8 rounded-full border border-purple-300/70 object-cover"
                                  onError={(event) => {
                                    event.currentTarget.src = profile.defaultAvatarSrc || "";
                                  }}
                                />
                              ) : (
                                <div className="flex h-8 w-8 items-center justify-center rounded-full border border-purple-300/70 bg-purple-800/30 text-xs">
                                  {profile.avatarFallback}
                                </div>
                              )}
                              <p className="max-w-full truncate text-[10px] font-semibold text-slate-100">{profile.displayName}</p>
                            </button>
                          ) : (
                            <p className="mt-2 text-[10px] text-slate-400">-</p>
                          )}
                        </div>
                      );
                    })}
                      </div>

                      <div className="mt-3 rounded-lg border border-emerald-600/35 bg-emerald-900/20 p-2">
                    <p className="mb-2 text-center text-[11px] font-semibold uppercase tracking-wide text-emerald-200">
                      5 Bilhetes Sorteados
                    </p>
                    {cycleWinners.length === 0 ? (
                      <p className="text-center text-xs text-slate-300">Aguardando sorteio dos bilhetes.</p>
                    ) : (
                      <div className="grid grid-cols-1 gap-2">
                        {cycleWinners.map((winner, index) => {
                          const profile = getParticipantProfileData(winner);
                          return (
                            <button
                              key={`${cycle.id}-winner-${winner.id || winner.user_id || index}-${index}`}
                              type="button"
                              onClick={() => openWinnerProfile(winner)}
                              className="flex items-center gap-2 rounded-md border border-emerald-700/40 bg-emerald-950/20 px-2 py-1.5 text-left"
                            >
                              {profile.avatarSrc ? (
                                <img
                                  src={profile.avatarSrc}
                                  alt={profile.displayName}
                                  className="h-7 w-7 rounded-full border border-emerald-300/60 object-cover"
                                  onError={(event) => {
                                    event.currentTarget.src = profile.defaultAvatarSrc || "";
                                  }}
                                />
                              ) : (
                                <div className="flex h-7 w-7 items-center justify-center rounded-full border border-emerald-300/60 bg-emerald-900/30 text-xs">
                                  {profile.avatarFallback}
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="truncate text-xs font-semibold text-emerald-100">{profile.displayName}</p>
                                <p className="truncate text-[10px] text-emerald-200/80">{profile.handle || "Participante"}</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                      </div>

                      <div className="mt-3 rounded-lg border border-cyan-600/35 bg-cyan-950/20 p-2">
                    <p className="mb-2 text-center text-[11px] font-semibold uppercase tracking-wide text-cyan-200">
                      Seus dados no ciclo
                    </p>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-md border border-cyan-700/35 bg-cyan-900/20 p-2 text-center">
                        <p className="text-[10px] text-cyan-200/80">Valor depositado</p>
                        <p className="text-sm font-bold text-cyan-100">R$ {myCycleData.totalDeposited.toFixed(2)}</p>
                      </div>
                      <div className="rounded-md border border-cyan-700/35 bg-cyan-900/20 p-2 text-center">
                        <p className="text-[10px] text-cyan-200/80">Seus bilhetes</p>
                        <p className="text-sm font-bold text-cyan-100">{myCycleData.totalTickets}</p>
                      </div>
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setHistoryPopup({ type: "tickets", cycleId: cycle.id })}
                        className="rounded-md border border-cyan-700/45 bg-cyan-900/25 p-2 text-center transition hover:bg-cyan-800/35"
                      >
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-cyan-200">Bilhetes Gerados</p>
                        <p className="text-xs text-cyan-100 mt-1">Toque para ver todos</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setHistoryPopup({ type: "deposits", cycleId: cycle.id })}
                        className="rounded-md border border-indigo-700/45 bg-indigo-900/25 p-2 text-center transition hover:bg-indigo-800/35"
                      >
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-200">Histórico Depósitos</p>
                        <p className="text-xs text-indigo-100 mt-1">Toque para ver detalhes</p>
                      </button>
                    </div>
                    </div>
                    </>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {historyPopup ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4"
          onClick={() => setHistoryPopup(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-950 p-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            {(() => {
              const selectedCycle = endedCycles.find((item) => item.id === historyPopup.cycleId);
              if (!selectedCycle) {
                return (
                  <div className="text-center text-slate-300">
                    <p>Ciclo não encontrado.</p>
                  </div>
                );
              }

              const selectedCycleData = getUserCycleData(selectedCycle.id);
              const selectedCycleTickets = getUserCycleTickets(selectedCycle.id);

              if (historyPopup.type === "tickets") {
                return (
                  <>
                    <p className="text-center text-sm font-bold uppercase tracking-wide text-cyan-200">
                      Bilhetes Gerados - Ciclo #{selectedCycle.cycle_number}
                    </p>
                    <div className="mt-3 max-h-[55vh] overflow-y-auto rounded-lg border border-cyan-700/35 bg-cyan-950/20 p-3">
                      {selectedCycleTickets.length === 0 ? (
                        <p className="text-center text-sm text-slate-300">Nenhum bilhete gerado neste ciclo.</p>
                      ) : (
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                          {selectedCycleTickets.map((ticket, index) => (
                            <div
                              key={`${selectedCycle.id}-ticket-${ticket}-${index}`}
                              className="rounded-md border border-cyan-700/40 bg-cyan-900/25 px-2 py-1.5 text-center"
                            >
                              <p className="text-xs font-semibold text-cyan-100">{String(ticket)}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                );
              }

              return (
                <>
                  <p className="text-center text-sm font-bold uppercase tracking-wide text-indigo-200">
                    Histórico de Depósitos - Ciclo #{selectedCycle.cycle_number}
                  </p>
                  <div className="mt-3 max-h-[55vh] overflow-y-auto rounded-lg border border-indigo-700/35 bg-indigo-950/20 p-3">
                    {selectedCycleData.all.length === 0 ? (
                      <p className="text-center text-sm text-slate-300">Você não registrou depósitos neste ciclo.</p>
                    ) : (
                      <div className="space-y-2">
                        {selectedCycleData.all.map((deposit) => {
                          const amount = parseFloat(deposit.amount) || 0;
                          const platformIdValue = deposit.user_platform_id || deposit.platform_id || "-";
                          const platformNameValue = deposit.platform_name || "Não informado";
                          const statusLabel =
                            deposit.status === "approved"
                              ? "Aprovado"
                              : deposit.status === "invalidated"
                              ? "Invalidado"
                              : deposit.status === "pending"
                              ? "Em análise"
                              : "Rejeitado";
                          const statusClass =
                            deposit.status === "approved"
                              ? "text-green-300"
                              : deposit.status === "invalidated"
                              ? "text-slate-300"
                              : deposit.status === "pending"
                              ? "text-yellow-300"
                              : "text-red-300";

                          return (
                            <div
                              key={`${selectedCycle.id}-deposit-${deposit.id}`}
                              className="rounded-md border border-slate-700/60 bg-slate-900/45 p-2"
                            >
                              <p className="text-xs text-slate-200">
                                {new Date(deposit.created_date).toLocaleString("pt-BR")}
                              </p>
                              <p className="text-sm font-bold text-white">R$ {amount.toFixed(2)}</p>
                              <p className={`text-xs font-semibold ${statusClass}`}>{statusLabel}</p>
                              <p className="text-[11px] text-slate-300 mt-1">
                                Plataforma: <span className="font-semibold text-slate-100">{platformNameValue}</span>
                              </p>
                              <p className="text-[11px] text-slate-300">
                                ID da plataforma: <span className="font-mono font-semibold text-slate-100">{platformIdValue}</span>
                              </p>
                              <p className="text-[11px] text-slate-400 mt-1">
                                Bilhetes deste deposito: {Number(deposit.tickets_count || deposit.ticket_numbers?.length || 0)}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              );
            })()}

            <div className="mt-4">
              <Button
                onClick={() => setHistoryPopup(null)}
                className="w-full bg-slate-800 text-slate-100 hover:bg-slate-700"
              >
                Fechar
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <LegalLinksBar />

    </motion.div>
  );
}

