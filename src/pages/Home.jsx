import React, { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { base44, resolveAssetUrl } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BellRing, Heart, Megaphone, Trophy, Users } from "lucide-react";
import { format } from "date-fns";
import { useNavigate, useSearchParams } from "react-router-dom";
import RichTextMessage from "@/components/RichTextMessage";
import LegalLinksBar from "@/components/LegalLinksBar";
import { createPageUrl } from "@/utils";
import { getProfileAvatarSrc } from "@/lib/profileMedia";
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

const FEED_PAGE_SIZE = 8;

export default function Home() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [visibleCount, setVisibleCount] = useState(FEED_PAGE_SIZE);
  const loadMoreRef = useRef(null);
  const postRefs = useRef({});
  const recentProfilesStripRef = useRef(null);
  const recentProfilesDragRef = useRef({ isDragging: false, startX: 0, startScrollLeft: 0, moved: false });
  const [highlightPostId, setHighlightPostId] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["inicio-posts"],
    queryFn: () => base44.entities.PushNotification.list("-created_date"),
    staleTime: 30000,
  });

  const { data: winnerFeed = { items: [] }, isLoading: winnersLoading } = useQuery({
    queryKey: ["inicio-winner-posts"],
    queryFn: () => base44.gamification.feedWins(),
    staleTime: 30000,
  });

  const { data: feedLikes = { counts: {}, likedPostIds: [] } } = useQuery({
    queryKey: ["inicio-feed-likes"],
    queryFn: () => base44.gamification.feedLikes(),
    staleTime: 15000,
  });

  const { data: users = [] } = useQuery({
    queryKey: ["inicio-users"],
    queryFn: () => base44.entities.User.list(),
    staleTime: 60000,
  });

  const { data: recentProfilesData } = useQuery({
    queryKey: ["inicio-recent-profiles"],
    queryFn: () => base44.social.discover({ limit: 10, offset: 0 }),
    staleTime: 60000,
  });

  const formattedMembersCount = users.length || 0;

  const publishedPosts = useMemo(() => {
    return posts.slice(0, 30);
  }, [posts]);

  const usersById = useMemo(() => {
    const map = new Map();
    users.forEach((item) => map.set(item.id, item));
    return map;
  }, [users]);

  const creatorProfile = useMemo(() => {
    const admin = users.find((item) => String(item.role || "").toLowerCase() === "admin");
    if (!admin) return null;
    const creatorPhoto =
      admin.profile_image_mode === "photo" &&
      admin.profile_image_status === "approved" &&
      admin.profile_image_url
        ? resolveAssetUrl(admin.profile_image_url)
        : null;
    return {
      id: admin.id,
      name: admin.full_name || admin.nick || "Souza",
      nick: admin.nick || "souza",
      avatarEmoji: admin.avatar_emoji || "S",
      avatarUrl: creatorPhoto || getProfileAvatarSrc(admin, avatarById, defaultAvatar) || defaultAvatar,
    };
  }, [users]);

  const recentProfiles = useMemo(() => {
    return (recentProfilesData?.items || []).map((profile) => {
      const avatarUrl = getProfileAvatarSrc(profile, avatarById, defaultAvatar) || defaultAvatar;
      return {
        id: profile.id,
        name: profile.nick || "Usuário",
        handle: profile.handle || "",
        avatarUrl,
      };
    });
  }, [recentProfilesData?.items]);

  const winnerPosts = useMemo(() => {
    return (winnerFeed?.items || [])
      .slice(0, 40)
      .map((item) => {
        const profile = usersById.get(item.user_id);
        const profileAvatarId = item.profile_avatar_id || profile?.profile_avatar_id || "";
        const profilePhoto =
          item.profile_image_mode === "photo" && item.profile_image_url
            ? resolveAssetUrl(item.profile_image_url)
            : null;

        return {
          id: `winner-${item.id}`,
          authorId: creatorProfile?.id || "",
          authorName: creatorProfile?.name || "Souza",
          authorNick: creatorProfile?.nick || "souza",
          authorAvatarEmoji: creatorProfile?.avatarEmoji || "S",
          authorAvatarUrl: creatorProfile?.avatarUrl || null,
          userId: item.user_id || profile?.id || "",
          userName: item.user_name || profile?.full_name || "Participante",
          userNick: item.user_nick || profile?.nick || "",
          avatarEmoji: item.user_avatar || profile?.avatar_emoji || "U",
          avatarUrl: profilePhoto || avatarById[profileAvatarId] || null,
          prizeTitle: item.source_label || "Premiação do app",
          rewardLabel: item.reward_label || item.title || "Prêmio",
          prizeAmount: Number(item.reward_amount) || 0,
          rewardUnit: item.reward_unit || "",
          createdAt: item.claimed_at,
        };
      });
  }, [winnerFeed?.items, usersById, creatorProfile]);

  const feedItems = useMemo(() => {
    const winnerFeed = winnerPosts.map((item) => ({
      ...item,
      type: "winner",
      createdAtTs: item.createdAt ? new Date(item.createdAt).getTime() : 0,
    }));

    const noticeFeed = publishedPosts.map((post) => ({
      type: "notice",
      id: `notice-${post.id}`,
      title: post.title || "Aviso",
      message: post.message || "",
      createdAt: post.sent_at || post.created_date,
      createdAtTs: post.sent_at || post.created_date ? new Date(post.sent_at || post.created_date).getTime() : 0,
    }));

    return [...winnerFeed, ...noticeFeed].sort((a, b) => b.createdAtTs - a.createdAtTs);
  }, [winnerPosts, publishedPosts]);

  useEffect(() => {
    setVisibleCount(FEED_PAGE_SIZE);
  }, [feedItems.length]);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (!first?.isIntersecting) return;
        setVisibleCount((prev) => Math.min(prev + FEED_PAGE_SIZE, feedItems.length));
      },
      { rootMargin: "140px 0px" }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [feedItems.length]);

  useEffect(() => {
    const targetPostId = searchParams.get("post");
    if (!targetPostId) return;

    const targetIndex = feedItems.findIndex((item) => item.id === targetPostId);
    if (targetIndex >= 0) {
      setVisibleCount((prev) => Math.max(prev, targetIndex + 1));
    }

    const timeout = setTimeout(() => {
      const element = postRefs.current[targetPostId];
      if (!element) return;
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightPostId(targetPostId);
      setTimeout(() => setHighlightPostId(""), 2400);
      setSearchParams({}, { replace: true });
    }, 200);

    return () => clearTimeout(timeout);
  }, [searchParams, setSearchParams, feedItems]);

  const likePostMutation = useMutation({
    mutationFn: (postId) => base44.gamification.likeFeedPost(postId),
    onMutate: async (postId) => {
      await queryClient.cancelQueries({ queryKey: ["inicio-feed-likes"] });
      const previous = queryClient.getQueryData(["inicio-feed-likes"]);
      queryClient.setQueryData(["inicio-feed-likes"], (current = { counts: {}, likedPostIds: [] }) => {
        const likedPostIds = Array.isArray(current.likedPostIds) ? current.likedPostIds : [];
        if (likedPostIds.includes(postId)) return current;
        return {
          counts: {
            ...(current.counts || {}),
            [postId]: Number(current.counts?.[postId] || 0) + 1,
          },
          likedPostIds: [...likedPostIds, postId],
        };
      });
      return { previous };
    },
    onError: (_error, _postId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["inicio-feed-likes"], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["inicio-feed-likes"] });
    },
  });

  const handleLike = (postId) => {
    const likedPostIds = Array.isArray(feedLikes?.likedPostIds) ? feedLikes.likedPostIds : [];
    if (!postId || likedPostIds.includes(postId) || likePostMutation.isPending) return;
    likePostMutation.mutate(postId);
  };

  const openProfilePage = () => {
    navigate(createPageUrl("Profile"));
  };

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
    event.preventDefault();
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
      event.preventDefault();
    }
  };

  if (isLoading || winnersLoading) {
    return (
      <div className="space-y-3">
        <Card className="border-slate-800 bg-slate-900/70 p-5 text-slate-300">Carregando avisos...</Card>
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
            <p className="text-sm text-slate-400">Avisos e posts para a galera acompanhar e interagir.</p>
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
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/60 p-4 text-sm text-slate-400">
            Os próximos perfis cadastrados vão aparecer aqui.
          </div>
        )}
      </Card>

      {feedItems.length === 0 ? (
        <Card className="border-slate-800 bg-slate-900/70 p-6 text-center">
          <BellRing className="mx-auto mb-2 h-6 w-6 text-cyan-300" />
          <p className="font-semibold text-white">Sem avisos publicados</p>
          <p className="text-sm text-slate-400 mt-1">
            Quando você enviar post/aviso no admin, eles aparecem aqui automaticamente.
          </p>
        </Card>
      ) : (
        <>
          {feedItems.slice(0, visibleCount).map((item) => {
            const likesCount = Number(feedLikes?.counts?.[item.id] || 0);
            const isLiked = Array.isArray(feedLikes?.likedPostIds) && feedLikes.likedPostIds.includes(item.id);

            if (item.type === "winner") {
              return (
                <Card
                  key={item.id}
                  ref={(node) => {
                    if (node) postRefs.current[item.id] = node;
                  }}
                  className={`border-emerald-700/40 bg-gradient-to-br from-emerald-950/35 to-slate-900/80 p-4 ${
                    highlightPostId === item.id ? "ring-2 ring-cyan-400/80" : ""
                  }`}
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={() => openPublicProfile(item.authorId)} className="rounded-full">
                        <img
                          src={item.authorAvatarUrl || defaultAvatar}
                          alt={item.authorName}
                          className="h-11 w-11 rounded-full border border-emerald-300/60 object-cover transition hover:opacity-90"
                          onError={(event) => {
                            event.currentTarget.src = defaultAvatar;
                          }}
                        />
                      </button>
                      <div>
                        <p className="text-sm font-bold text-emerald-100">{item.authorName}</p>
                        <button
                          type="button"
                          onClick={() => openPublicProfile(item.authorId)}
                          className="text-xs text-emerald-200/80 transition hover:text-emerald-100 hover:underline"
                        >
                          {item.authorNick ? `@${item.authorNick}` : "@souza"}
                        </button>
                      </div>
                    </div>
                    <span className="text-xs text-slate-400">
                      {item.createdAt ? format(new Date(item.createdAt), "dd/MM HH:mm") : "Agora"}
                    </span>
                  </div>

                  <div className="rounded-lg border border-emerald-700/40 bg-emerald-900/20 px-3 py-2">
                    <p className="text-sm font-semibold text-emerald-100">Parabéns! Novo ganhador no app 🎉</p>
                    <p className="mt-1 text-sm text-slate-200">
                      <button
                        type="button"
                        onClick={() => openPublicProfile(item.userId)}
                        className="font-semibold text-emerald-100 transition hover:text-emerald-50 hover:underline"
                      >
                        {item.userNick ? `@${item.userNick}` : item.userName}
                      </button>{" "}
                      ganhou no{" "}
                      <span className="font-semibold text-emerald-200">{item.prizeTitle}</span>
                    </p>
                    <p className="mt-1 text-sm font-bold text-yellow-300">{item.rewardLabel}</p>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-300">
                      <Trophy className="h-3.5 w-3.5" />
                      Post automático de ganhador
                    </span>
                    <Button
                      onClick={() => handleLike(item.id)}
                      variant="outline"
                      disabled={isLiked}
                      className="h-8 border-slate-700 bg-slate-800/60 px-3 text-xs text-slate-200 hover:bg-slate-700 disabled:cursor-default disabled:opacity-100"
                    >
                      <Heart className="mr-1 h-3.5 w-3.5" />
                      {isLiked ? `Curtido (${likesCount})` : `Curtir (${likesCount})`}
                    </Button>
                  </div>
                </Card>
              );
            }

            return (
              <Card
                key={item.id}
                ref={(node) => {
                  if (node) postRefs.current[item.id] = node;
                }}
                className={`border-slate-800 bg-slate-900/70 p-4 ${
                  highlightPostId === item.id ? "ring-2 ring-cyan-400/80" : ""
                }`}
              >
                <div className="mb-2 flex items-start justify-between gap-3">
                  <h3 className="text-base font-bold text-white">{item.title || "Aviso"}</h3>
                  <span className="text-xs text-slate-500">
                    {item.createdAt ? format(new Date(item.createdAt), "dd/MM HH:mm") : "Agora"}
                  </span>
                </div>

                <RichTextMessage
                  text={item.message}
                  className="text-sm leading-relaxed text-slate-300 break-words whitespace-pre-wrap"
                />

                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs text-slate-500">Post da administração</span>
                  <Button
                    onClick={() => handleLike(item.id)}
                    variant="outline"
                    disabled={isLiked}
                    className="h-8 border-slate-700 bg-slate-800/60 px-3 text-xs text-slate-200 hover:bg-slate-700 disabled:cursor-default disabled:opacity-100"
                  >
                    <Heart className="mr-1 h-3.5 w-3.5" />
                    {isLiked ? `Curtido (${likesCount})` : `Curtir (${likesCount})`}
                  </Button>
                </div>
              </Card>
            );
          })}

          {visibleCount < feedItems.length ? (
            <div ref={loadMoreRef} className="py-3 text-center text-xs text-slate-500">
              Carregando mais posts...
            </div>
          ) : (
            <div className="py-2 text-center text-xs text-slate-600">Você chegou ao fim dos posts.</div>
          )}
        </>
      )}

      <LegalLinksBar />
    </div>
  );
}


