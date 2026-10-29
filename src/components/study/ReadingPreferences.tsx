"use client";

import { useEffect, useRef, useState } from "react";
import { textFor, type Locale } from "@/lib/i18n";
import {
  defaultStudyPreferences,
  type StudyPreferences,
  type StudyTheme,
} from "@/lib/study-types";
import { readAnonymousPreferences } from "@/lib/study-client";
import { useStudyResource } from "./useStudyResource";
import { SyncStatus } from "./SyncStatus";

export function ReadingPreferences({
  locale,
  userId,
}: {
  locale: Locale;
  userId?: string;
}) {
  const root = useRef<HTMLDetailsElement>(null);
  const preferences = useStudyResource<StudyPreferences>(
    "/api/study/preferences",
    userId,
    defaultStudyPreferences,
    {},
    600,
  );
  const [localLoaded, setLocalLoaded] = useState(false);
  const [localStored, setLocalStored] = useState(true);
  const setPreferences = preferences.setValue;
  useEffect(() => {
    if (userId) return;
    try {
      setPreferences(
        readAnonymousPreferences(
          localStorage.getItem("chemistry.reader.preferences.anonymous"),
        ),
      );
    } catch {
      setLocalStored(false);
    }
    setLocalLoaded(true);
  }, [userId, setPreferences]);
  useEffect(() => {
    if (userId || !localLoaded) return;
    try {
      localStorage.setItem(
        "chemistry.reader.preferences.anonymous",
        JSON.stringify(preferences.value),
      );
      setLocalStored(true);
    } catch {
      setLocalStored(false);
    }
  }, [userId, localLoaded, preferences.value]);
  useEffect(() => {
    const article = root.current
      ?.closest("article")
      ?.querySelector<HTMLElement>("[data-study-body]");
    if (!article) return;
    article.style.setProperty(
      "--study-font-size",
      `${preferences.value.fontSize}px`,
    );
    article.style.setProperty(
      "--study-line-height",
      String(preferences.value.lineHeight),
    );
    article.dataset.studyTheme = preferences.value.theme;
    return () => {
      article.style.removeProperty("--study-font-size");
      article.style.removeProperty("--study-line-height");
      delete article.dataset.studyTheme;
    };
  }, [preferences.value]);
  const update = (next: Partial<StudyPreferences>) =>
    preferences.setValue({ ...preferences.value, ...next });
  return (
    <details className="study-preferences" ref={root}>
      <summary>
        {textFor(locale, "阅读设置", "Reading settings")}{" "}
        <span aria-hidden="true">Aa</span>
      </summary>
      <div className="study-preferences-fields">
        <label>
          {textFor(locale, "字号", "Text size")}{" "}
          <span>{preferences.value.fontSize}px</span>
          <input
            type="range"
            min="16"
            max="24"
            step="1"
            value={preferences.value.fontSize}
            disabled={!preferences.ready}
            onChange={(event) =>
              update({ fontSize: Number(event.target.value) })
            }
          />
        </label>
        <label>
          {textFor(locale, "行距", "Line spacing")}
          <select
            value={preferences.value.lineHeight}
            disabled={!preferences.ready}
            onChange={(event) =>
              update({ lineHeight: Number(event.target.value) })
            }
          >
            {[1.5, 1.8, 2, 2.2].map((height) => (
              <option key={height} value={height}>
                {height}
              </option>
            ))}
          </select>
        </label>
        <label>
          {textFor(locale, "纸张外观", "Page appearance")}
          <select
            value={preferences.value.theme}
            disabled={!preferences.ready}
            onChange={(event) =>
              update({ theme: event.target.value as StudyTheme })
            }
          >
            {(
              [
                ["system", "跟随网站", "Website default"],
                ["light", "明亮", "Light"],
                ["sepia", "暖纸色", "Warm paper"],
                ["dark", "深色", "Dark"],
              ] as const
            ).map(([value, zh, en]) => (
              <option value={value} key={value}>
                {textFor(locale, zh, en)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {!userId && !localStored ? (
        <p className="study-sync">
          {textFor(
            locale,
            "浏览器未允许保存设置，本次页面仍可使用。",
            "Browser storage is unavailable. These settings apply to this page only.",
          )}
        </p>
      ) : (
        <SyncStatus
          locale={locale}
          phase={preferences.phase}
          errorCode={preferences.errorCode}
          retry={preferences.retry}
          onKeep={() => preferences.resolve("keep-local")}
          onUse={() => preferences.resolve("use-cloud")}
        />
      )}
    </details>
  );
}
