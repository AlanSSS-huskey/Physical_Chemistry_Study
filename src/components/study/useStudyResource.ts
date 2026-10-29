"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  sameStudyValue,
  studyRequest,
  StudyRequestError,
} from "@/lib/study-client";
import { reconcileStudySave, resolveStudyConflict } from "@/lib/study-sync";
import { BEFORE_STATE_NAVIGATION } from "@/lib/navigation-guard";

export type StudySyncPhase =
  "loading" | "synced" | "pending" | "saving" | "error" | "conflict" | "local";

export function useStudyResource<T extends { revision: number }>(
  path: string,
  userId: string | undefined,
  initial: T,
  identity: Record<string, unknown>,
  delay: number,
  warnUnsaved = false,
) {
  const [value, setState] = useState<T>(initial);
  const [phase, setPhase] = useState<StudySyncPhase>(
    userId ? "loading" : "local",
  );
  const [ready, setReady] = useState(!userId);
  const [remote, setRemote] = useState<T | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const latest = useRef(value);
  const revision = useRef(initial.revision);
  const generation = useRef(0);
  const saving = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const identityRef = useRef(identity);
  identityRef.current = identity;
  latest.current = value;

  // Positions are throttled while scrolling; text/settings debounce until edits pause.
  const saveTrigger = delay >= 3000 ? value.revision : value;
  useEffect(() => {
    if (!userId) return;
    const abort = new AbortController();
    controller.current = abort;
    setPhase("loading");
    void studyRequest<T>(path, userId, { signal: abort.signal })
      .then((loaded) => {
        if (abort.signal.aborted) return;
        revision.current = loaded.revision;
        latest.current = loaded;
        setState(loaded);
        setReady(true);
        setPhase("synced");
        setErrorCode(null);
      })
      .catch((error) => {
        if (abort.signal.aborted) return;
        setPhase("error");
        setErrorCode(
          error instanceof StudyRequestError ? error.code : "UNAVAILABLE",
        );
      });
    return () => abort.abort();
  }, [path, userId, loadAttempt]);

  const setValue = useCallback(
    (next: T) => {
      generation.current++;
      latest.current = next;
      setState(next);
      setPhase((current) =>
        current === "conflict" ? "conflict" : userId ? "pending" : "local",
      );
    },
    [userId],
  );

  const save = useCallback(async () => {
    if (
      !userId ||
      !ready ||
      saving.current ||
      remote ||
      controller.current?.signal.aborted
    )
      return;
    if (!navigator.onLine) {
      setPhase("pending");
      return;
    }
    const snapshot = { ...latest.current, revision: revision.current };
    const saveSignal = controller.current?.signal;
    const started = generation.current;
    saving.current = true;
    setPhase("saving");
    setErrorCode(null);
    try {
      const saved = await studyRequest<T>(path.split("?")[0], userId, {
        method: "PUT",
        body: { ...identityRef.current, ...snapshot },
        signal: saveSignal,
      });
      if (saveSignal?.aborted) return;
      revision.current = saved.revision;
      const next = reconcileStudySave(
        latest.current,
        saved,
        started !== generation.current,
      );
      latest.current = next.value;
      setState(next.value);
      setPhase(next.phase);
    } catch (error) {
      if (saveSignal?.aborted) return;
      const failure =
        error instanceof StudyRequestError
          ? error
          : new StudyRequestError("UNAVAILABLE");
      if (
        failure.code === "CONFLICT" &&
        failure.current &&
        typeof failure.current === "object" &&
        "revision" in failure.current
      ) {
        const cloud = failure.current as T;
        if (sameStudyValue(snapshot, cloud)) {
          revision.current = cloud.revision;
          const next = reconcileStudySave(
            latest.current,
            cloud,
            started !== generation.current,
          );
          latest.current = next.value;
          setState(next.value);
          setPhase(next.phase);
        } else {
          setRemote(cloud);
          setPhase("conflict");
        }
      } else {
        setErrorCode(failure.code);
        setPhase("error");
      }
    } finally {
      saving.current = false;
    }
  }, [path, userId, ready, remote]);

  useEffect(() => {
    if (phase !== "pending" || !userId) return;
    const timer = window.setTimeout(() => {
      void save();
    }, delay);
    return () => window.clearTimeout(timer);
  }, [phase, saveTrigger, userId, delay, save]);

  useEffect(() => {
    const retry = () => {
      if (["pending", "error"].includes(phase) && ready) void save();
    };
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [phase, ready, save]);

  useEffect(() => {
    if (
      !warnUnsaved ||
      !ready ||
      !["pending", "saving", "error", "conflict"].includes(phase)
    )
      return;
    const preventClose = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const confirmDiscard = () =>
      window.confirm(
        document.documentElement.lang.startsWith("zh")
          ? "笔记尚未同步。离开会丢失本页未保存的文字，仍要离开吗？"
          : "Your note has not synced. Leaving will discard unsaved text on this page. Leave anyway?",
      );
    const confirmStateChange = (event: Event) => {
      if (event.defaultPrevented) return;
      if (!confirmDiscard()) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    const confirmNavigation = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const link =
        event.target instanceof Element
          ? event.target.closest("a[href]")
          : null;
      if (
        !(link instanceof HTMLAnchorElement) ||
        link.target === "_blank" ||
        link.hasAttribute("download")
      )
        return;
      const destination = new URL(link.href, location.href);
      if (
        destination.pathname === location.pathname &&
        destination.search === location.search
      )
        return;
      if (!confirmDiscard()) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    window.addEventListener("beforeunload", preventClose);
    window.addEventListener(BEFORE_STATE_NAVIGATION, confirmStateChange);
    document.addEventListener("click", confirmNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", preventClose);
      window.removeEventListener(BEFORE_STATE_NAVIGATION, confirmStateChange);
      document.removeEventListener("click", confirmNavigation, true);
    };
  }, [phase, ready, warnUnsaved]);

  const resolve = (choice: "keep-local" | "use-cloud") => {
    if (!remote) return;
    const next = resolveStudyConflict(latest.current, remote, choice);
    revision.current = remote.revision;
    generation.current++;
    latest.current = next.value;
    setState(next.value);
    setRemote(null);
    setPhase(next.phase);
  };
  const retry = () => {
    if (!ready) setLoadAttempt((attempt) => attempt + 1);
    else void save();
  };
  return { value, setValue, phase, ready, remote, errorCode, resolve, retry };
}
