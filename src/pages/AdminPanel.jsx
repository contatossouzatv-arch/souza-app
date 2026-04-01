import React, { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Settings,
  Trophy,
  BarChart3,
  Gamepad2,
  Bell,
  TrendingUp,
  Zap,
  Gift,
  FileText,
  ExternalLink,
  Share2,
  Building2,
  Camera,
  Gem,
  Users,
} from "lucide-react";
import DepositsTab from "../components/admin/DepositsTab.jsx";
import DepositCyclesTab from "../components/admin/DepositCyclesTab.jsx";
import LiveDrawTab from "../components/admin/LiveDrawTab.jsx";
import DepositantDrawTab from "../components/admin/DepositantDrawTab.jsx";
import PromoBoxesTab from "../components/admin/PromoBoxesTab.jsx";
import SettingsTab from "../components/admin/SettingsTab.jsx";
import StatsTab from "../components/admin/StatsTab.jsx";
import AuditTab from "../components/admin/AuditTab.jsx";
import GameCallDrawTab from "../components/admin/GameCallDrawTab.jsx";
import NotificationsTab from "../components/admin/NotificationsTab.jsx";
import InstantRaffleTab from "../components/admin/InstantRaffleTab";
import PlatformsTab from "../components/admin/PlatformsTab";
import SocialMediaTab from "../components/admin/SocialMediaTab";
import CurrentPlatformTab from "../components/admin/CurrentPlatformTab";
import ProfileImagesTab from "../components/admin/ProfileImagesTab";
import GamificationTab from "../components/admin/GamificationTab";
import UsersAdminTab from "../components/admin/UsersAdminTab";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";

const DailyChestTab = React.lazy(() => import("../components/admin/DailyChestTab"));

export default function AdminPanel() {
  const { toast } = useToast();
  const previousPendingPhotosRef = useRef(null);
  const previousPendingDepositsRef = useRef(null);
  const [activeTab, setActiveTab] = useState("deposits");

  const { data: pendingProfileImages = [] } = useQuery({
    queryKey: ["admin-profile-images-pending-counter"],
    queryFn: () => base44.auth.listAdminProfileImages("manual_review"),
    enabled: activeTab === "profile-images",
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });

  const pendingPhotosCount = pendingProfileImages.length;

  const { data: pendingDeposits = [] } = useQuery({
    queryKey: ["admin-deposits-pending-counter"],
    queryFn: async () => {
      const response = await base44.deposits.adminList({ status: "pending" });
      return response.items || [];
    },
    enabled: activeTab === "deposits",
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });

  const pendingDepositsCount = pendingDeposits.length;

  useEffect(() => {
    if (previousPendingPhotosRef.current === null) {
      previousPendingPhotosRef.current = pendingPhotosCount;
      return;
    }

    if (pendingPhotosCount > previousPendingPhotosRef.current) {
      const newItems = pendingPhotosCount - previousPendingPhotosRef.current;
      toast({
        title: "Nova foto para aprovar",
        description:
          newItems === 1
            ? "Chegou 1 nova foto pendente na moderação."
            : `Chegaram ${newItems} novas fotos pendentes na moderação.`,
      });
    }

    previousPendingPhotosRef.current = pendingPhotosCount;
  }, [pendingPhotosCount, toast]);

  useEffect(() => {
    if (previousPendingDepositsRef.current === null) {
      previousPendingDepositsRef.current = pendingDepositsCount;
      return;
    }

    if (pendingDepositsCount > previousPendingDepositsRef.current) {
      const newItems = pendingDepositsCount - previousPendingDepositsRef.current;
      toast({
        title: "Novo depósito pendente",
        description:
          newItems === 1
            ? "Chegou 1 novo depósito para aprovação."
            : `Chegaram ${newItems} novos depósitos para aprovação.`,
      });
    }

    previousPendingDepositsRef.current = pendingDepositsCount;
  }, [pendingDepositsCount, toast]);

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 text-center">
          <h1 className="mb-2 bg-gradient-to-r from-yellow-300 to-pink-300 bg-clip-text text-3xl font-bold text-transparent md:text-4xl">
            Painel Administrativo
          </h1>
          <p className="mb-6 text-purple-300">Gerencie todos os aspectos da plataforma</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="flex h-auto w-full flex-wrap gap-2 bg-purple-900/50 p-2">
            <TabsTrigger value="deposits" className="flex items-center gap-2 data-[state=active]:bg-purple-700">
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">Depósitos</span>
              {pendingDepositsCount > 0 ? (
                <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {pendingDepositsCount}
                </span>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="deposit-cycles" className="flex items-center gap-2 data-[state=active]:bg-indigo-700">
              <Trophy className="h-4 w-4" />
              <span className="hidden sm:inline">Ciclos Sorteio</span>
            </TabsTrigger>
            <TabsTrigger value="live-draw" className="flex items-center gap-2 data-[state=active]:bg-green-700">
              <Zap className="h-4 w-4" />
              <span className="hidden sm:inline">Sorteio Live</span>
            </TabsTrigger>
            <TabsTrigger value="game-call" className="flex items-center gap-2 data-[state=active]:bg-blue-700">
              <Gamepad2 className="h-4 w-4" />
              <span className="hidden sm:inline">Call Jogo</span>
            </TabsTrigger>
            <TabsTrigger value="instant-raffle" className="flex items-center gap-2 data-[state=active]:bg-pink-700">
              <Gift className="h-4 w-4" />
              <span className="hidden sm:inline">Sorteio Rapido</span>
            </TabsTrigger>
            <TabsTrigger value="depositant-draw" className="flex items-center gap-2 data-[state=active]:bg-orange-700">
              <Trophy className="h-4 w-4" />
              <span className="hidden sm:inline">Sorteio Geral</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2 data-[state=active]:bg-cyan-700">
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">Posts</span>
            </TabsTrigger>
            <TabsTrigger value="audit" className="flex items-center gap-2 data-[state=active]:bg-indigo-700">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Auditoria</span>
            </TabsTrigger>
            <TabsTrigger value="stats" className="flex items-center gap-2 data-[state=active]:bg-teal-700">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Estatisticas</span>
            </TabsTrigger>
            <TabsTrigger value="users-admin" className="flex items-center gap-2 data-[state=active]:bg-sky-700">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Usuários</span>
            </TabsTrigger>
            <TabsTrigger value="promos" className="flex items-center gap-2 data-[state=active]:bg-red-700">
              <Gift className="h-4 w-4" />
              <span className="hidden sm:inline">Promocoes</span>
            </TabsTrigger>
            <TabsTrigger value="platforms" className="flex items-center gap-2 data-[state=active]:bg-yellow-700">
              <ExternalLink className="h-4 w-4" />
              <span className="hidden sm:inline">Plataformas</span>
            </TabsTrigger>
            <TabsTrigger value="socials" className="flex items-center gap-2 data-[state=active]:bg-pink-700">
              <Share2 className="h-4 w-4" />
              <span className="hidden sm:inline">Redes Sociais</span>
            </TabsTrigger>
            <TabsTrigger value="current-platform" className="flex items-center gap-2 data-[state=active]:bg-cyan-700">
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">Plataforma Atual</span>
            </TabsTrigger>
            <TabsTrigger value="profile-images" className="flex items-center gap-2 data-[state=active]:bg-fuchsia-700">
              <Camera className="h-4 w-4" />
              <span className="hidden sm:inline">Fotos Perfil</span>
              {pendingPhotosCount > 0 ? (
                <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {pendingPhotosCount}
                </span>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2 data-[state=active]:bg-gray-700">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Configurações</span>
            </TabsTrigger>
            <TabsTrigger value="achievements-rules" className="flex items-center gap-2 data-[state=active]:bg-emerald-700">
              <Trophy className="h-4 w-4" />
              <span className="hidden sm:inline">Gamificação</span>
            </TabsTrigger>
            <TabsTrigger value="daily-chest" className="flex items-center gap-2 data-[state=active]:bg-cyan-700">
              <Gem className="h-4 w-4" />
              <span className="hidden sm:inline">Baú Diário</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="deposits">
            {activeTab === "deposits" ? <DepositsTab /> : null}
          </TabsContent>
          <TabsContent value="deposit-cycles">
            {activeTab === "deposit-cycles" ? <DepositCyclesTab /> : null}
          </TabsContent>
          <TabsContent value="live-draw">
            {activeTab === "live-draw" ? <LiveDrawTab /> : null}
          </TabsContent>
          <TabsContent value="game-call">
            {activeTab === "game-call" ? <GameCallDrawTab /> : null}
          </TabsContent>
          <TabsContent value="instant-raffle">
            {activeTab === "instant-raffle" ? <InstantRaffleTab /> : null}
          </TabsContent>
          <TabsContent value="depositant-draw">
            {activeTab === "depositant-draw" ? <DepositantDrawTab /> : null}
          </TabsContent>
          <TabsContent value="notifications">
            {activeTab === "notifications" ? <NotificationsTab /> : null}
          </TabsContent>
          <TabsContent value="audit">
            {activeTab === "audit" ? <AuditTab /> : null}
          </TabsContent>
          <TabsContent value="stats">
            {activeTab === "stats" ? <StatsTab /> : null}
          </TabsContent>
          <TabsContent value="users-admin">
            {activeTab === "users-admin" ? <UsersAdminTab /> : null}
          </TabsContent>
          <TabsContent value="promos">
            {activeTab === "promos" ? <PromoBoxesTab /> : null}
          </TabsContent>
          <TabsContent value="platforms">
            {activeTab === "platforms" ? <PlatformsTab /> : null}
          </TabsContent>
          <TabsContent value="socials">
            {activeTab === "socials" ? <SocialMediaTab /> : null}
          </TabsContent>
          <TabsContent value="current-platform">
            {activeTab === "current-platform" ? <CurrentPlatformTab /> : null}
          </TabsContent>
          <TabsContent value="profile-images">
            {activeTab === "profile-images" ? <ProfileImagesTab /> : null}
          </TabsContent>
          <TabsContent value="settings">
            {activeTab === "settings" ? <SettingsTab /> : null}
          </TabsContent>
          <TabsContent value="achievements-rules">
            {activeTab === "achievements-rules" ? <GamificationTab /> : null}
          </TabsContent>
          <TabsContent value="daily-chest">
            {activeTab === "daily-chest" ? <DailyChestTab /> : null}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
