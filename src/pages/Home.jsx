import React, { useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Megaphone, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import LegalLinksBar from "@/components/LegalLinksBar";
import { createPageUrl } from "@/utils";
import { getProfileAvatarSrc } from "@/lib/profileMedia";
import { useAuth } from "@/lib/AuthContext";
import defaultAvatar from "../../assets-para-app/avatar/avatar padrao perfil sem foto.png";

const avatarModules = import.meta.glob("../../assets-para-app/avatar/*.png", {
  eager: true,
  import: "default",
});

const avatarById = Object.entries(avatarModules).reduce((acc, [path, src]) => {
  const id = path.split("/").pop().replace(".png", "");
  acc[id] = src;
  return acc;
}, {});

export default function Home() {
  const navigate = useNavigate();
  const { user, isLoadingAuth } = useAuth();
  const recentProfilesStripRef = useRef(null);
  const recentProfilesDragRef = useRef({ isDragging: false, startX: 0, startScrollLeft: 0, moved: false });

  const {
    data: homeSummary,
    isLoading: isLoadingHomeSummary,
  } = useQuery({
    queryKey: ["inicio-summary"],
    queryFn: () => base44.home.summary(),
    enabled: Boolean(user?.id) && !isLoadingAuth,
    staleTime: 300000,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });

  const formattedMembersCount = Number(homeSummary?.totalMembers || 0);

  const recentProfiles = useMemo(() => {
    return (homeSummary?.recentProfiles || []).map((profile) => {
      const avatarUrl = getProfileAvatarSrc(profile, avatarById, defaultAvatar) || defaultAvatar;
      return {
        id: profile.id,
        name: profile.nick || "Usuário",
        handle: profile.handle || "",
        avatarUrl,
      };
    });
  }, [homeSummary?.recentProfiles]);

  const openPublicProfile = (profileId) => {
    if (!profileId) return;
    navigate(`/profile?user=${encodeURIComponent(profileId)}`);
  };

  const openProfilesGallery = () => {
    navigate(createPageUrl("ProfilesGallery"));
  };

  const handleRecentProfilesPointerDown = (event) => {
    const container = recentProfilesStripRef.current;
    if (!container || event.button !== 0) return;
    const interactiveTarget = event.target?.closest?.("button,a,input,textarea,select,label");
    if (interactiveTarget && interactiveTarget !== container) return;
    recentProfilesDragRef.current = {
      isDragging: true,
      startX: event.clientX,
      startScrollLeft: container.scrollLeft,
      moved: false,
    };
    container.setPointerCapture?.(event.pointerId);
  };

  const handleRecentProfilesPointerMove = (event) => {
    const container = recentProfilesStripRef.current;
    const drag = recentProfilesDragRef.current;
    if (!container || !drag.isDragging) return;
    const deltaX = event.clientX - drag.startX;
    if (Math.abs(deltaX) > 8) {
      recentProfilesDragRef.current.moved = true;
    }
    container.scrollLeft = drag.startScrollLeft - deltaX;
    if (event.cancelable) {
      event.preventDefault();
    }
  };

  const handleRecentProfilesPointerUpOrCancel = (event) => {
    const container = recentProfilesStripRef.current;
    if (container?.hasPointerCapture?.(event.pointerId)) {
      container.releasePointerCapture(event.pointerId);
    }
    recentProfilesDragRef.current.isDragging = false;
  };

  const handleRecentProfilesClickCapture = (event) => {
    if (recentProfilesDragRef.current.moved) {
      event.preventDefault();
      event.stopPropagation();
      recentProfilesDragRef.current.moved = false;
    }
  };

  const handleRecentProfilesWheel = (event) => {
    const container = recentProfilesStripRef.current;
    if (!container) return;
    if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
      container.scrollLeft += event.deltaY;
      if (event.cancelable) {
        event.preventDefault();
      }
    }
  };

  if (isLoadingAuth) {
    return (
      <div className="space-y-3">
        <Card className="border-slate-800 bg-slate-900/70 p-5 text-slate-300">Carregando...</Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-slate-800 bg-gradient-to-r from-indigo-500/15 to-slate-900 p-5">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-indigo-500/20 p-2">
            <Megaphone className="h-5 w-5 text-indigo-300" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Início</h1>
            <p className="text-sm text-slate-400">Bem-vindo ao app! Veja os últimos membros cadastrados.</p>
          </div>
        </div>
      </Card>

      <Card className="border-slate-800 bg-slate-900/70 p-4">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex items-center gap-3">
            <div className="rounded-xl bg-cyan-500/15 p-2">
              <Users className="h-5 w-5 text-cyan-300" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold text-white">Últimos usuários cadastrados</h2>
                <span className="inline-flex items-center rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-bold text-cyan-200">
                  Total de membros do APP: {formattedMembersCount}
                </span>
              </div>
              <p className="mt-1 text-sm leading-snug text-slate-400">Siga e curta perfis para ganhar pontos e XP</p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={openProfilesGallery}
            className="h-10 w-full shrink-0 whitespace-normal rounded-xl border-slate-700 bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 sm:w-auto"
          >
            Exibir mais perfis
          </Button>
        </div>

        {recentProfiles.length ? (
          <div
            ref={recentProfilesStripRef}
            onPointerDown={handleRecentProfilesPointerDown}
            onPointerMove={handleRecentProfilesPointerMove}
            onPointerUp={handleRecentProfilesPointerUpOrCancel}
            onPointerCancel={handleRecentProfilesPointerUpOrCancel}
            onClickCapture={handleRecentProfilesClickCapture}
            onWheel={handleRecentProfilesWheel}
            className="hide-scrollbar flex gap-3 overflow-x-auto pb-2 touch-pan-x select-none"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {recentProfiles.map((profile) => (
              <button
                key={profile.id}
                type="button"
                onClick={() => openPublicProfile(profile.id)}
                className="w-[104px] shrink-0 rounded-2xl border border-slate-800 bg-slate-950/80 p-3 text-center transition hover:border-cyan-400/50 hover:bg-slate-900"
              >
                <img
                  src={profile.avatarUrl}
                  alt={profile.name}
                  className="mx-auto h-16 w-16 rounded-full border border-slate-700 object-cover"
                  onError={(event) => {
                    event.currentTarget.src = defaultAvatar;
                  }}
                />
                <p className="mt-2 truncate text-sm font-semibold text-white">{profile.name}</p>
                <p className="truncate text-[11px] text-slate-400">@{profile.handle || "usuario"}</p>
                <p className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">NOVO</p>
              </button>
            ))}
          </div>
        ) : isLoadingHomeSummary ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-400">
            Carregando perfis recentes...
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/60 p-4 text-sm text-slate-400">
            Os próximos perfis cadastrados vão aparecer aqui.
          </div>
        )}
      </Card>

      <LegalLinksBar />
    </div>
  );
}


