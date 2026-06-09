import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { getApiUrl } from "@/utils/apiUrl";

/**
 * Lightweight online/offline detection without adding native dependencies.
 *
 * - Web: trusts `navigator.onLine` and the window online/offline events, and
 *   confirms with a periodic reachability ping to the API health endpoint.
 * - Native: there is no reliable zero-dep signal, so we poll a fast HEAD/GET
 *   against the API with a short timeout and treat success as "online".
 *
 * Designed for "poor network / rural area" resilience: a failed ping flips the
 * app into offline mode so screens can fall back to cached data.
 */
export function useConnectivity(pingIntervalMs = 20000): boolean {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (Platform.OS === "web" && typeof navigator !== "undefined" && typeof navigator.onLine === "boolean") {
      return navigator.onLine;
    }
    return true; // optimistic until the first ping resolves
  });
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;

    const ping = async () => {
      // On web, if the browser says we're offline, believe it immediately.
      if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.onLine === false) {
        if (mounted.current) setIsOnline(false);
        return;
      }
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(`${getApiUrl()}/api/healthz`, {
          method: "GET",
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (mounted.current) setIsOnline(res.ok);
      } catch {
        if (mounted.current) setIsOnline(false);
      }
    };

    ping();
    const interval = setInterval(ping, pingIntervalMs);

    let onUp: (() => void) | undefined;
    let onDown: (() => void) | undefined;
    if (Platform.OS === "web" && typeof window !== "undefined" && window.addEventListener) {
      onUp = () => { setIsOnline(true); ping(); };
      onDown = () => setIsOnline(false);
      window.addEventListener("online", onUp);
      window.addEventListener("offline", onDown);
    }

    return () => {
      mounted.current = false;
      clearInterval(interval);
      if (Platform.OS === "web" && typeof window !== "undefined" && window.removeEventListener) {
        if (onUp) window.removeEventListener("online", onUp);
        if (onDown) window.removeEventListener("offline", onDown);
      }
    };
  }, [pingIntervalMs]);

  return isOnline;
}
