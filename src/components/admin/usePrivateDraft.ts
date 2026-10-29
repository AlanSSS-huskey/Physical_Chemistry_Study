"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  adminMutation,
  HistoryRequestError,
  restoreEditorFields,
  type EditorFields,
} from "@/lib/content-history-client";
import { readApiObject } from "@/lib/editor";

type Recovery = {
  payload: EditorFields;
  revision: number;
  baseVersion: number | null;
  updatedAt: string;
};
export function usePrivateDraft(
  contentId: string | undefined,
  version: number,
  fields: EditorFields,
  dirty: boolean,
  recoverFields: (fields: EditorFields) => void,
  adminUserId: string,
) {
  const key = contentId ?? "new";
  const endpoint = `/api/admin/content/drafts/${encodeURIComponent(key)}`;
  const [state, setState] = useState<
    "loading" | "ready" | "saving" | "saved" | "error" | "conflict"
  >("loading");
  const [recovery, setRecovery] = useState<Recovery | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const fieldsRef = useRef(fields);
  const revision = useRef(0);
  const savedJson = useRef(JSON.stringify(fields));
  const initialJson = useRef(JSON.stringify(fields));
  const ready = useRef(false);
  const paused = useRef(false);
  const inFlight = useRef<Promise<void> | null>(null);
  fieldsRef.current = fields;

  const load = useCallback(async () => {
    ready.current = false;
    setError(null);
    setState("loading");
    try {
      const response = await fetch(endpoint, {
        cache: "no-store",
        credentials: "same-origin",
        headers: { "X-Admin-User": adminUserId },
      });
      const result = await readApiObject(response);
      if (!response.ok || result.ok !== true)
        throw new HistoryRequestError(
          typeof result.code === "string" ? result.code : "UNAVAILABLE",
          response.status,
        );
      const draft = result.data as Record<string, unknown> | null;
      const payload = restoreEditorFields(draft?.payload);
      if (
        draft &&
        payload &&
        typeof draft.revision === "number" &&
        typeof draft.updatedAt === "string"
      ) {
        revision.current = draft.revision;
        setRecovery({
          payload,
          revision: draft.revision,
          baseVersion:
            typeof draft.baseVersion === "number" ? draft.baseVersion : null,
          updatedAt: draft.updatedAt,
        });
      } else {
        revision.current = 0;
        ready.current = true;
      }
      setState("ready");
    } catch (failure) {
      setError(failure);
      setState("error");
    }
  }, [endpoint, adminUserId]);
  useEffect(() => {
    void load();
  }, [load]);

  const flush = useCallback(async () => {
    if (!ready.current) throw new HistoryRequestError("DRAFT_PENDING");
    while (inFlight.current) await inFlight.current;
    const current = fieldsRef.current;
    const snapshot = JSON.stringify(current);
    if (snapshot !== savedJson.current) {
      const task = (async () => {
        setState("saving");
        setError(null);
        const result = await adminMutation(
          endpoint,
          "PUT",
          {
            payload: current,
            expectedRevision: revision.current,
            contentId: contentId ?? null,
            baseVersion: contentId ? version : null,
          },
          fetch,
          adminUserId,
        );
        const data = result.data as Record<string, unknown> | undefined;
        if (
          result.ok !== true ||
          typeof data?.revision !== "number" ||
          typeof data.updatedAt !== "string"
        )
          throw new HistoryRequestError("UNAVAILABLE");
        revision.current = data.revision;
        savedJson.current = snapshot;
        setUpdatedAt(data.updatedAt);
        setState(
          JSON.stringify(fieldsRef.current) === snapshot ? "saved" : "ready",
        );
      })();
      inFlight.current = task;
      try {
        await task;
      } catch (failure) {
        if (
          failure instanceof HistoryRequestError &&
          ["DRAFT_CONFLICT", "SESSION_CHANGED"].includes(failure.code)
        ) {
          ready.current = false;
          setState("conflict");
        } else setState("error");
        setError(failure);
        throw failure;
      } finally {
        inFlight.current = null;
      }
    }
    return revision.current > 0
      ? { draftKey: key, draftRevision: revision.current }
      : {};
  }, [contentId, endpoint, key, version, adminUserId]);

  useEffect(() => {
    if (
      !dirty ||
      !ready.current ||
      paused.current ||
      recovery ||
      state === "error" ||
      state === "conflict" ||
      state === "loading" ||
      state === "saving" ||
      JSON.stringify(fields) === savedJson.current
    )
      return;
    const timer = setTimeout(() => {
      void flush().catch(() => {});
    }, 1500);
    return () => clearTimeout(timer);
  }, [fields, dirty, recovery, flush, state]);

  async function recover() {
    if (!recovery) return;
    recoverFields(recovery.payload);
    savedJson.current = JSON.stringify(recovery.payload);
    setUpdatedAt(recovery.updatedAt);
    setRecovery(null);
    ready.current = true;
    setState("saved");
  }
  async function discard() {
    if (!recovery) return;
    setError(null);
    try {
      const result = await adminMutation(
        endpoint,
        "DELETE",
        {
          expectedRevision: recovery.revision,
        },
        fetch,
        adminUserId,
      );
      if (result.ok !== true) throw new HistoryRequestError("UNAVAILABLE");
      revision.current = 0;
      savedJson.current = initialJson.current;
      setRecovery(null);
      ready.current = true;
      setState("ready");
    } catch (failure) {
      setError(failure);
    }
  }
  return {
    state,
    recovery,
    error,
    updatedAt,
    ready: ready.current && !recovery,
    load,
    recover,
    discard,
    retry: flush,
    async beginSave() {
      paused.current = true;
      return flush();
    },
    completeSave() {
      revision.current = 0;
      savedJson.current = JSON.stringify(fieldsRef.current);
      setUpdatedAt(null);
      setState("ready");
    },
    finishSave() {
      paused.current = false;
    },
  };
}
