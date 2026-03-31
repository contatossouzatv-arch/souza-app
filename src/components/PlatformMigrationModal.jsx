import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { AlertCircle, Check, ExternalLink, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { usePlatformsSummary } from "@/hooks/usePlatformsSummary";

export default function PlatformMigrationModal({ user, onVisibilityChange, onConfirmed }) {
  const queryClient = useQueryClient();
  const [platformId, setPlatformId] = useState("");
  const [loading, setLoading] = useState(false);
  const [isQueryReady, setIsQueryReady] = useState(false);
  const { isLoadingAuth } = useAuth();

  useEffect(() => {
    setIsQueryReady(false);
    if (isLoadingAuth || !user?.id || !user?.onboarding_completed) return undefined;
    const timerId = window.setTimeout(() => {
      setIsQueryReady(true);
    }, 4000);
    return () => window.clearTimeout(timerId);
  }, [isLoadingAuth, user?.id, user?.onboarding_completed]);

  const { data: platforms = [] } = usePlatformsSummary({
    select: (data) => (data?.currentPlatform ? [data.currentPlatform] : []),
    enabled: isQueryReady,
    staleTime: 300000,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const { data: platformHistory = [] } = useQuery({
    queryKey: ["platform-history", user?.id],
    queryFn: async () => {
      const response = await base44.adminEvents.profile.platformHistory();
      return response.items || [];
    },
    enabled: isQueryReady,
    staleTime: 300000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const currentPlatform = platforms[0] || null;

  const shouldShowModal = useMemo(() => {
    if (!user || !currentPlatform || !currentPlatform.active) return false;
    if (!user.onboarding_completed) return false;

    const normalizedCurrentPlatformName = String(currentPlatform.name || "").trim().toLowerCase();
    const normalizedUserPlatformId = String(user.platform_id || "").trim().toLowerCase();
    const alreadyHasSamePlatformRegistered = platformHistory.some((entry) => {
      const entryName = String(entry.platform_name || "").trim().toLowerCase();
      const entryId = String(entry.platform_id || "").trim().toLowerCase();
      if (!entryName || !entryId) return false;
      if (entryName !== normalizedCurrentPlatformName) return false;
      return entryId === normalizedUserPlatformId || Boolean(normalizedUserPlatformId && entryId);
    });

    if (alreadyHasSamePlatformRegistered) return false;

    const localConfirmed = localStorage.getItem(`platform_confirmed_${currentPlatform.platform_id}`);
    if (localConfirmed === "true") return false;

    if (user.confirmed_platform_id === currentPlatform.platform_id) return false;

    return true;
  }, [user, currentPlatform, platformHistory]);

  useEffect(() => {
    if (onVisibilityChange) onVisibilityChange(shouldShowModal);
  }, [onVisibilityChange, shouldShowModal]);

  const handleConfirm = async () => {
    if (!platformId.trim()) {
      toast({
        title: "Campo obrigatorio",
        description: "Digite o ID correspondente da plataforma.",
        variant: "destructive",
      });
      return;
    }

    if (!currentPlatform || !user) return;

    setLoading(true);

    try {
      await base44.auth.updateMe({
        platform_id: platformId.trim(),
        confirmed_platform_id: currentPlatform.platform_id,
      });

      try {
        await base44.entities.PlatformHistory.create({
          user_id: user.id,
          platform_name: currentPlatform.name,
          platform_id: platformId.trim(),
          created_at: new Date().toISOString(),
        });
      } catch (historyError) {
        console.error("Erro ao salvar histórico de plataforma:", historyError);
      }

      localStorage.setItem(`platform_confirmed_${currentPlatform.platform_id}`, "true");

      await queryClient.invalidateQueries();
      if (onConfirmed) {
        await onConfirmed();
      }

      setPlatformId("");
      toast({
        title: "Cadastro confirmado",
        description: "Seu acesso aos sorteios ja esta liberado.",
      });
    } catch (error) {
      toast({
        title: "Erro ao confirmar",
        description: "Não foi possível validar agora. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!shouldShowModal || !currentPlatform) return null;

  return (
    <Dialog open={true} onOpenChange={() => {}}>
      <DialogContent
        className="max-h-[92vh] max-w-[95vw] overflow-y-auto border-violet-700/60 bg-gradient-to-br from-slate-950 via-violet-950 to-slate-900 text-white md:max-w-xl [&>button]:hidden"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-center text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-orange-300 to-pink-300">
            Confirmacao de Plataforma
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-2xl border border-amber-500/50 bg-amber-900/20 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 text-amber-300" />
              <div>
                <p className="text-sm font-semibold text-amber-200">Cadastro obrigatorio para participar</p>
                <p className="mt-1 text-sm text-amber-100/90">
                  Para participar dos sorteios, confirme seu cadastro pela plataforma oficial abaixo.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-violet-600/60 bg-violet-900/25 p-4 text-center">
            <p className="text-sm font-bold text-violet-200">NOVIDADES!!! Plataforma NOVA no pedaço!</p>
            <p className="mt-1 text-xl font-extrabold text-white">{currentPlatform.name}</p>
            <a
              href={currentPlatform.link}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 px-4 py-2.5 text-sm font-bold text-white transition hover:brightness-110"
            >
              <ExternalLink className="h-4 w-4" />
              Criar conta na plataforma
            </a>
          </div>

          <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
            <Label htmlFor="platform-id" className="text-slate-200">
              ID correspondente da plataforma
            </Label>
            <Input
              id="platform-id"
              value={platformId}
              onChange={(e) => setPlatformId(e.target.value)}
              placeholder="Digite seu ID"
              className="mt-2 border-slate-700 bg-slate-950/80 text-white"
              disabled={loading}
              onKeyDown={(e) => {
                if (e.key === "Enter" && platformId.trim()) {
                  handleConfirm();
                }
              }}
            />
            <p className="mt-2 text-xs text-slate-400">Use o mesmo ID vinculado ao seu cadastro na plataforma.</p>

            <Button
              onClick={handleConfirm}
              disabled={loading || !platformId.trim()}
              className="mt-4 w-full bg-gradient-to-r from-indigo-600 to-violet-600 font-bold hover:from-indigo-700 hover:to-violet-700"
            >
              <Check className="mr-2 h-4 w-4" />
              {loading ? "Confirmando..." : "Confirmar cadastro"}
            </Button>
          </div>

          <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="h-4 w-4 text-cyan-300" />
            Esse passo aparece apenas uma vez por plataforma ativa.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


