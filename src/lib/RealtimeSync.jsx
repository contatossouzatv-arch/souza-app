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
          withCredentials: true,
          reconnection: true,
          reconnectionAttempts: 20,
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
  }, [isAuthenticated, queryClient]);

  return null;
}
