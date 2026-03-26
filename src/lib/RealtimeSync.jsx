import { useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { resolveApiBaseUrl } from "@/lib/apiBaseUrl";
import { useAuth } from "@/lib/AuthContext";

const API_BASE_URL = resolveApiBaseUrl();

function addKeys(target, keys = []) {
  keys.forEach((key) => {
    if (key) target.add(key);
  });
}

export default function RealtimeSync() {
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();
  const invalidateTimerRef = useRef(null);
  const retryTimerRef = useRef(null);
  const reconnectAttemptRef = useRef(0);

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
        const prefixes = new Set();

        if (["livedrawraffle", "livedrawparticipant"].includes(entity)) {
          addKeys(prefixes, [
            "dashboard-dynamics-summary",
            "active-live-raffle-box",
            "active-raffle",
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
            "dashboard-dynamics-summary",
            "admin-active-gamecall",
            "active-gamecall-raffle",
            "admin-gamecall-participants",
            "validated-gamecall-winners",
            "my-gamecall-participation",
            "winner-audits",
            "inicio-winner-posts",
            "user-prize-gallery",
          ]);
        }

        if (["instantraffle", "instantraffleparticipant", "promobox"].includes(entity)) {
          addKeys(prefixes, [
            "dashboard-dynamics-summary",
            "my-winnings",
            "winner-audits",
            "inicio-winner-posts",
            "user-prize-gallery",
          ]);
        }

        if (["appsettings", "bannercarousel", "socialmedia"].includes(entity)) {
          addKeys(prefixes, ["public-ui-config", "app-settings"]);
        }

        if (prefixes.size > 0) {
          invalidatePrefixes([...prefixes]);
        }
      }, 120);
    };

    const scheduleReconnect = () => {
      if (cancelled || retryTimerRef.current) return;
      reconnectAttemptRef.current += 1;
      const delayMs = Math.min(30000, 3000 * reconnectAttemptRef.current);
      retryTimerRef.current = setTimeout(() => {
        retryTimerRef.current = null;
        connectSocket();
      }, delayMs);
    };

    const connectSocket = () => {
      if (cancelled) return;

      socket = io(API_BASE_URL, {
        transports: ["websocket"],
        withCredentials: true,
        reconnection: false,
        timeout: 4000,
      });

      socket.on("connect", () => {
        reconnectAttemptRef.current = 0;
      });

      socket.on("entity:changed", scheduleInvalidate);
      socket.on("connect_error", () => {
        if (socket) {
          socket.off("entity:changed", scheduleInvalidate);
          socket.disconnect();
          socket = null;
        }
        scheduleReconnect();
      });
      socket.on("disconnect", (reason) => {
        if (reason === "io client disconnect") return;
        scheduleReconnect();
      });
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
      reconnectAttemptRef.current = 0;
    };
  }, [isAuthenticated, queryClient]);

  return null;
}
