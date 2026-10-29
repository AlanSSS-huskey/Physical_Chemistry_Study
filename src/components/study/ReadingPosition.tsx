"use client";

import { useEffect, useRef, useState } from "react";
import { textFor, type Locale } from "@/lib/i18n";
import { useLocale } from "@/components/LocaleProvider";
import { readingSnapshot } from "@/lib/study-client";
import type { StudyPosition } from "@/lib/study-types";
import { useStudyResource } from "./useStudyResource";
import { SyncStatus } from "./SyncStatus";

export function ReadingPosition({
  slug,
  locale,
  userId,
}: {
  slug: string;
  locale: Locale;
  userId: string;
}) {
  const { locale: uiLocale } = useLocale();
  const root = useRef<HTMLDivElement>(null);
  const interacted = useRef(false);
  const initialCaptured = useRef(false);
  const [resume, setResume] = useState<StudyPosition | null>(null);
  const position = useStudyResource<StudyPosition>(
    `/api/study/position?${new URLSearchParams({ slug, locale })}`,
    userId,
    { anchor: null, progress: 0, revision: 0 },
    { slug, locale },
    5000,
  );
  const current = useRef(position.value);
  current.current = position.value;
  const setPosition = position.setValue;
  useEffect(() => {
    if (!position.ready || initialCaptured.current) return;
    initialCaptured.current = true;
    if (position.value.revision > 0 && position.value.progress > 0.01)
      setResume(position.value);
  }, [position.ready, position.value]);
  useEffect(() => {
    if (!position.ready) return;
    const body = root.current
      ?.closest("article")
      ?.querySelector<HTMLElement>("[data-study-body]");
    if (!body) return;
    let timer: number | undefined;
    const interact = () => {
      interacted.current = true;
    };
    const capture = () => {
      if (!interacted.current) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const top = body.getBoundingClientRect().top + window.scrollY;
        const headings = [
          ...body.querySelectorAll<HTMLElement>(
            "h1[id],h2[id],h3[id],h4[id],h5[id],h6[id]",
          ),
        ].map((heading) => ({
          id: heading.id,
          top: heading.getBoundingClientRect().top + window.scrollY - top,
        }));
        const snapshot = readingSnapshot(
          window.scrollY - top,
          body.offsetHeight,
          window.innerHeight,
          headings,
        );
        if (
          Math.abs(snapshot.progress - current.current.progress) < 0.005 &&
          snapshot.anchor === current.current.anchor
        )
          return;
        setPosition({ ...current.current, ...snapshot });
      }, 180);
    };
    window.addEventListener("wheel", interact, { passive: true });
    window.addEventListener("touchstart", interact, { passive: true });
    window.addEventListener("keydown", interact);
    window.addEventListener("scroll", capture, { passive: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("wheel", interact);
      window.removeEventListener("touchstart", interact);
      window.removeEventListener("keydown", interact);
      window.removeEventListener("scroll", capture);
    };
  }, [position.ready, setPosition]);
  function continueReading() {
    const body = root.current
      ?.closest("article")
      ?.querySelector<HTMLElement>("[data-study-body]");
    if (!body || !resume) return;
    const heading = resume.anchor
      ? [...body.querySelectorAll<HTMLElement>("[id]")].find(
          (item) => item.id === resume.anchor,
        )
      : null;
    const top = heading
      ? heading.getBoundingClientRect().top + window.scrollY - 100
      : body.getBoundingClientRect().top +
        window.scrollY +
        resume.progress * Math.max(0, body.offsetHeight - innerHeight);
    interacted.current = true;
    window.scrollTo({ top: Math.max(0, top), behavior: "auto" });
    setResume(null);
  }
  return (
    <div className="study-position" ref={root}>
      <div className="study-position-heading">
        <span>{textFor(uiLocale, "阅读位置", "Reading position")}</span>
        <span>{Math.round(position.value.progress * 100)}%</span>
      </div>
      <div className="study-position-track" aria-hidden="true">
        <span
          style={{ width: `${Math.round(position.value.progress * 100)}%` }}
        />
      </div>
      {resume && (
        <button
          type="button"
          className="study-text-button"
          onClick={continueReading}
        >
          {textFor(
            uiLocale,
            `继续上次阅读（${Math.round(resume.progress * 100)}%）→`,
            `Resume at ${Math.round(resume.progress * 100)}% →`,
          )}
        </button>
      )}
      <SyncStatus
        locale={uiLocale}
        phase={position.phase}
        errorCode={position.errorCode}
        retry={position.retry}
        onKeep={() => position.resolve("keep-local")}
        onUse={() => position.resolve("use-cloud")}
      />
      {position.phase === "conflict" && position.remote && (
        <p className="study-helper">
          {textFor(
            uiLocale,
            `云端位置：${Math.round(position.remote.progress * 100)}%。`,
            `Cloud position: ${Math.round(position.remote.progress * 100)}%.`,
          )}
        </p>
      )}
    </div>
  );
}
