import React from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Users } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getProfileAvatarFallback, getProfileAvatarSrc } from "@/lib/profileMedia";
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

const PAGE_SIZE = 24;

function getProfilePriority(profile) {
  const hasPhoto =
    String(profile?.profile_image_mode || "").toLowerCase() === "photo" &&
    Boolean(String(profile?.profile_image_url || "").trim());
  if (hasPhoto) return 0;

  const hasCustomAvatar =
    Boolean(String(profile?.profile_avatar_id || "").trim()) ||
    Boolean(String(profile?.avatar_emoji || "").trim());
  if (hasCustomAvatar) return 1;

  return 2;
}

export default function ProfilesGallery() {
  const navigate = useNavigate();
  const loadMoreRef = React.useRef(null);
  const [search, setSearch] = React.useState("");

  const { data, isLoading, isFetchingNextPage, fetchNextPage, hasNextPage } = useInfiniteQuery({
    queryKey: ["profiles-gallery"],
    queryFn: ({ pageParam = 0 }) => base44.social.discover({ limit: PAGE_SIZE, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => (lastPage?.hasMore ? lastPage?.nextOffset ?? undefined : undefined),
    staleTime: 60000,
  });

  React.useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || !hasNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          fetchNextPage();
        }
      },
      { rootMargin: "160px 0px" }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage]);

  const profiles = React.useMemo(() => {
    return (data?.pages || []).flatMap((page) => page?.items || []);
  }, [data?.pages]);

  const normalizedSearch = search.trim().toLowerCase().replace(/^@+/, "");

  const filteredProfiles = React.useMemo(() => {
    const baseProfiles = !normalizedSearch
      ? profiles
      : profiles.filter((profile) => {
      const nick = String(profile?.nick || "").toLowerCase();
      const handle = String(profile?.handle || "").toLowerCase().replace(/^@+/, "");
      return nick.includes(normalizedSearch) || handle.includes(normalizedSearch);
    });

    return [...baseProfiles].sort((a, b) => {
      const priorityDiff = getProfilePriority(a) - getProfilePriority(b);
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(b?.created_date || 0).getTime() - new Date(a?.created_date || 0).getTime();
    });
  }, [normalizedSearch, profiles]);

  const openProfile = (profileId) => {
    navigate(`/profile?user=${encodeURIComponent(profileId)}`);
  };

  return (
    <div className="space-y-4">
      <Card className="border-slate-800 bg-gradient-to-r from-cyan-500/15 to-slate-900 p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-cyan-500/20 p-2">
              <Users className="h-5 w-5 text-cyan-300" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Galeria de perfis</h1>
              <p className="text-sm text-slate-400">Todos os perfis reais do app carregando aos poucos.</p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/home")}
            className="border-slate-700 bg-slate-950 text-white hover:bg-slate-800"
          >
            Voltar
          </Button>
        </div>
      </Card>

      <Card className="border-slate-800 bg-slate-900/70 p-4">
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Buscar perfil</p>
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Digite nome ou @"
            className="border-slate-700 bg-slate-950 text-white placeholder:text-slate-500"
          />
        </div>
      </Card>

      {isLoading ? (
        <Card className="border-slate-800 bg-slate-900/70 p-6 text-center text-slate-400">
          Carregando perfis...
        </Card>
      ) : filteredProfiles.length ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {filteredProfiles.map((profile) => {
              const avatarUrl = getProfileAvatarSrc(profile, avatarById, defaultAvatar) || defaultAvatar;
              const avatarFallback = getProfileAvatarFallback(profile, "U");

              return (
                <button
                  key={profile.id}
                  type="button"
                  onClick={() => openProfile(profile.id)}
                  className="rounded-3xl border border-slate-800 bg-slate-900/70 p-4 text-center transition hover:border-cyan-400/50 hover:bg-slate-900"
                >
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={profile.nick || "Usuário"}
                      className="mx-auto h-20 w-20 rounded-full border border-slate-700 object-cover"
                      onError={(event) => {
                        event.currentTarget.style.display = "none";
                        const fallbackNode = event.currentTarget.nextElementSibling;
                        if (fallbackNode instanceof HTMLElement) {
                          fallbackNode.style.display = "flex";
                        }
                      }}
                    />
                  ) : null}
                  <div
                    className="mx-auto h-20 w-20 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-2xl font-black text-white"
                    style={{ display: avatarUrl ? "none" : "flex" }}
                  >
                    {avatarFallback}
                  </div>
                  <p className="mt-3 truncate text-sm font-bold text-white">{profile.nick || "Usuário"}</p>
                  <p className="truncate text-xs text-slate-400">@{profile.handle || "usuario"}</p>
                </button>
              );
            })}
          </div>
          <div ref={loadMoreRef} className="py-4 text-center text-xs text-slate-500">
            {isFetchingNextPage ? "Carregando mais perfis..." : hasNextPage ? "Role para carregar mais perfis" : "Fim da galeria"}
          </div>
        </>
      ) : (
        <Card className="border-slate-800 bg-slate-900/70 p-6 text-center text-slate-400">
          {normalizedSearch ? "Nenhum perfil encontrado para essa busca." : "Nenhum perfil disponível ainda."}
        </Card>
      )}
    </div>
  );
}
