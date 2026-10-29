"use client";

import { useEffect, useState } from "react";
import { accountRequest } from "./account-client";

export type AccountCapabilities = {
  passwordLogin: boolean;
  registration: boolean;
  mail: boolean;
  google: boolean;
  googlePreviewUnavailable?: boolean;
};

export function useCapabilities() {
  const [capabilities, setCapabilities] = useState<AccountCapabilities | null>(
    null,
  );
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    accountRequest<{ ok: true; data: AccountCapabilities }>(
      "/api/account/capabilities",
      { signal: controller.signal },
    )
      .then((result) => setCapabilities(result.data))
      .catch((reason) => {
        if (!controller.signal.aborted) setError(reason);
      });
    return () => controller.abort();
  }, [attempt]);
  return { capabilities, error, retry: () => setAttempt((value) => value + 1) };
}
