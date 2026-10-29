"use client";

import { useEffect, useRef, useState } from "react";
import {
  AccountRequestError,
  accountRequest,
  tokenFromFragment,
} from "./account-client";

export function useMailToken(purpose: "verify" | "reset") {
  const savedToken = useRef<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [state, setState] = useState<
    "checking" | "missing" | "valid" | "invalid" | "expired" | "unavailable"
  >("checking");
  const [emailMasked, setEmailMasked] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!savedToken.current) {
      savedToken.current = tokenFromFragment(window.location.hash);
      if (new URLSearchParams(window.location.hash.slice(1)).has("token"))
        window.history.replaceState(
          window.history.state,
          "",
          `${window.location.pathname}${window.location.search}`,
        );
    }
    const value = savedToken.current;
    setToken(value);
    if (!value) {
      setState("missing");
      return;
    }
    const controller = new AbortController();
    setState("checking");
    setError(null);
    accountRequest<{ ok: true; data: { valid: true; emailMasked: string } }>(
      "/api/account/token-status",
      {
        method: "POST",
        body: { token: value, purpose },
        signal: controller.signal,
      },
    )
      .then((result) => {
        if (controller.signal.aborted) return;
        setEmailMasked(result.data.emailMasked);
        setState("valid");
      })
      .catch((reason) => {
        if (controller.signal.aborted) return;
        setError(reason);
        setState(
          reason instanceof AccountRequestError &&
            reason.code === "TOKEN_EXPIRED"
            ? "expired"
            : reason instanceof AccountRequestError &&
                reason.code === "TOKEN_INVALID"
              ? "invalid"
              : "unavailable",
        );
      });
    return () => controller.abort();
  }, [purpose, attempt]);
  return {
    token,
    state,
    emailMasked,
    error,
    retry: () => setAttempt((value) => value + 1),
  };
}
