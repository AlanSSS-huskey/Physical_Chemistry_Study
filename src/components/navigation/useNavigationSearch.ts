"use client";
import { useEffect, useState } from "react";
import {
  navigationSearch,
  type NavigationSearchHit,
} from "@/lib/navigation-search";

export function useNavigationSearch(
  open: boolean,
  query: string,
  locale: "zh" | "en",
  sessionKey: string,
) {
  const [phase, setPhase] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const [hits, setHits] = useState<NavigationSearchHit[]>([]);
  const [partial, setPartial] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    setHits([]);
    setPartial(false);
    if (!open || !query.trim()) {
      setPhase("idle");
      return;
    }
    const controller = new AbortController();
    setPhase("loading");
    const timer = window.setTimeout(() => {
      void navigationSearch(query, locale, { signal: controller.signal })
        .then((result) => {
          if (controller.signal.aborted) return;
          setHits(result.hits);
          setPartial(result.partial);
          setPhase("ready");
        })
        .catch(() => {
          if (!controller.signal.aborted) setPhase("error");
        });
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, query, locale, sessionKey, attempt]);
  return {
    phase,
    hits,
    partial,
    retry: () => setAttempt((value) => value + 1),
  };
}
