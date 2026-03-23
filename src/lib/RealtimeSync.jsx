import { useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:3011").replace(/\/$/, "");

function addKeys(target, keys = []) {
  keys.forEach((key) => {
    if (key) target.add(key);
  });
}

export default function RealtimeSync() {
  const queryClient = useQueryClient();
  const { isAuthenticated, user } = useAuth();
  const invalidateTimerRef = useRef(null);
  const retryTimerRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated) return undefined;

    let socket = null;
    let cancelled = false;

    const invalidatePrefixes = (prefixes = []) => {
      const allowed = new Set(prefixes.filter(Boolean));
      if (allowed.size === 0) return;
      queryClient.invalidateQueries({
        predicate: (query) => allowed.has(String(query.queryKey?.[0] || "")),
      });
    };

    const scheduleInvalidate = (event = {}) => {
      if (invalidateTimerRef.current) return;
      invalidateTimerRef.current = setTimeout(() => {
        invalidateTimerRef.current = null;

        const entity = String(event?.entity || "").trim().toLowerCase();
        const payload = event?.payload || {};
        const affectedUserId = String(
          payload?.user_id || payload?.target_user_id || payload?.userId || payload?.targetUserId || ""
        ).trim();
        const shouldRefreshCurrentUser = !affectedUserId || String(user?.id || "") === affectedUserId;
        const prefixes = new Set();

        if (["deposit", "depositantdrawcycle", "depositantdrawwinner"].includes(entity)) {
          addKeys(prefixes, [
            "deposits",
            "user-deposit-history",
            "all-deposits",
            "admin-deposits-authoritative",
            "admin-deposits-pending-counter",
            "deposit-cycles",
            "deposit-cycles-admin",
            "active-cycle-pending",
            "all-approved-deposits",
            "depositant-winners",
            "pending-raffle-cycles",
            "last-ended-cycle-depositant-draw",
            "all-ended-cycles",
          ]);
        }

        if (
          [
            "gamification",
            "gamificationrule",
            "weeklytopconfig",
            "weeklycycle",
            "gamification_checkin_config",
            "dailychestsettings",
            "dailychestrewardconfig",
            "daily_checkins",
            "user_follows",
            "profile_likes",
            "competitionpointevent",
          ].includes(entity)
        ) {
          addKeys(prefixes, [
            "leaderboards-weekly",
            "admin-leaderboards-weekly",
            "admin-gamification-overview",
            "admin-gamification-rules",
            "admin-gamification-checkin-config",
            "admin-gamification-weekly-config",
            "admin-gamification-cycles",
            "admin-daily-chest-config-v2",
            "admin-users-list",
            "admin-user-detail",
            "admin-user-history",
          ]);

          if (shouldRefreshCurrentUser) {
            addKeys(prefixes, [
              "profile-gamification-authoritative",
              "profile-history-authoritative",
              "social-my-state",
              "social-following-list",
              "social-follower-list",
              "daily-checkin-state",
              "user-prize-gallery",
              "profile-daily-chest-xp",
              "profile-competition-bonus-events",
              "points-me",
            ]);
          }
        }

        if (["livedrawraffle", "livedrawparticipant"].includes(entity)) {
          addKeys(prefixes, [
            "active-live-raffle-box",
            "active-raffle",
            "active-live-raffles",
            "raffle-participants",
            "validated-winners",
            "my-live-participation",
            "my-winnings",
            "winner-audits",
            "inicio-winner-posts",
            "user-prize-gallery",
          ]);
        }

        if (["gamecallraffle", "gamecallparticipant"].includes(entity)) {
          addKeys(prefixes, [
            "admin-active-gamecall",
            "active-gamecall-raffle",
            "active-gamecall-raffles",
            "admin-gamecall-participants",
            "validated-gamecall-winners",
            "my-gamecall-participation",
            "winner-audits",
            "inicio-winner-posts",
            "user-prize-gallery",
          ]);
        }

        if (["instantraffle", "instantraffleparticipant"].includes(entity)) {
          addKeys(prefixes, [
            "admin-instant-raffle",
            "active-instant-raffle",
            "admin-instant-participants",
            "instant-raffle-participants",
            "my-instant-participation",
            "previous-instant-raffles",
            "winner-audits",
            "inicio-winner-posts",
            "user-prize-gallery",
          ]);
        }

        if (["drawwinneraudit", "userprizegalleryitem"].includes(entity)) {
          addKeys(prefixes, [
            "winner-audits",
            "inicio-winner-posts",
            "user-prize-gallery",
            "admin-user-history",
          ]);
        }

        if (
          [
            "appsettings",
            "currentplatform",
            "platform",
            "bannercarousel",
            "socialmedia",
            "pushnotification",
            "user",
          ].includes(entity)
        ) {
          addKeys(prefixes, [
            "settings",
            "app-settings",
            "deposit-settings",
            "live-settings",
            "winner-settings",
            "current-platform",
            "all-platforms",
            "active-platforms",
            "admin-banners",
            "carousel-banners",
            "admin-socials",
            "active-socials",
            "social-bar-settings",
            "social-settings",
            "inicio-users",
            "inicio-recent-profiles",
            "profiles-gallery",
            "profile-discover-profiles",
            "current-user",
            "profile-all-deposits",
            "social-following-list",
            "social-follower-list",
          ]);

          addKeys(prefixes, [
            "profile-gamification-authoritative",
            "profile-history-authoritative",
          ]);
        }

        if (prefixes.size > 0) {
          invalidatePrefixes([...prefixes]);
        }
      }, 120);
    };

    const connectSocket = async () => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 1500);

        const health = await fetch(`${API_BASE_URL}/health`, {
          method: "GET",
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!health.ok || cancelled) return;

        socket = io(API_BASE_URL, {
          transports: ["websocket", "polling"],
          reconnection: true,
          reconnectionAttempts: Infinity,
          reconnectionDelay: 500,
          reconnectionDelayMax: 3000,
          timeout: 5000,
        });

        socket.on("entity:changed", scheduleInvalidate);
      } catch {
        if (cancelled) return;
        retryTimerRef.current = setTimeout(connectSocket, 10000);
      }
    };

    connectSocket();

    return () => {
      cancelled = true;
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      if (invalidateTimerRef.current) {
        clearTimeout(invalidateTimerRef.current);
        invalidateTimerRef.current = null;
      }
      if (socket) {
        socket.off("entity:changed", scheduleInvalidate);
        socket.disconnect();
      }
    };
  }, [isAuthenticated, queryClient, user?.id]);

  return null;
}
