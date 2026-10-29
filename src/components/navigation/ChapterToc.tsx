"use client";

import { useEffect, useRef, useState } from "react";
import { textFor, type Locale } from "@/lib/i18n";
import {
  activeReadingSection,
  readingTocEntries,
  readingHeadingLabel,
  type ReadingLabelNode,
  type ReadingTocEntry,
} from "@/lib/reading-toc";

function labelNode(node: Node): ReadingLabelNode {
  if (node.nodeType !== 1)
    return node.nodeType === 3 ? (node.nodeValue ?? "") : "";
  const element = node as Element;
  const attributes: Record<string, string> = {};
  for (const name of [
    "class",
    "hidden",
    "aria-hidden",
    "encoding",
    "data-footnote-ref",
    "data-footnote-backref",
  ]) {
    const value = element.getAttribute(name);
    if (value !== null) attributes[name] = value;
  }
  return {
    tag: element.tagName.toLowerCase(),
    attributes,
    children: [...element.childNodes].map(labelNode),
  };
}

export function ChapterToc({
  locale,
  contentKey,
}: {
  locale: Locale;
  contentKey: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [entries, setEntries] = useState<ReadingTocEntry[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 761px)");
    const resize = () => setExpanded(media.matches);
    resize();
    media.addEventListener("change", resize);
    return () => media.removeEventListener("change", resize);
  }, []);
  useEffect(() => {
    const container = root.current?.closest(".reader-layout");
    if (!container) return;
    let body: HTMLElement | null = null;
    let headings: HTMLElement[] = [];
    let frame = 0;
    const updateActive = () => {
      frame = 0;
      const offset = Math.max(
        140,
        (document.querySelector(".site-header")?.getBoundingClientRect()
          .height ?? 88) + 24,
      );
      setActive(
        activeReadingSection(
          headings.map((heading) => ({
            id: heading.id,
            top: heading.getBoundingClientRect().top,
          })),
          offset,
          {
            atEnd:
              window.scrollY + window.innerHeight >=
              document.documentElement.scrollHeight - 2,
            scrollY: window.scrollY,
            height: window.innerHeight,
          },
        ),
      );
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(updateActive);
    };
    const collect = () => {
      if (!body) return;
      const candidates = [
        ...body.querySelectorAll<HTMLElement>("h2[id],h3[id]"),
      ];
      const found = readingTocEntries(
        candidates.map((heading) => ({
          id: heading.id,
          text: readingHeadingLabel(labelNode(heading)),
          level: Number(heading.tagName.slice(1)),
          visible:
            heading.getClientRects().length > 0 &&
            !heading.closest(
              '[hidden],[aria-hidden="true"],.sr-only,.visually-hidden',
            ),
        })),
      );
      const ids = new Set(found.map((entry) => entry.id));
      const seen = new Set<string>();
      headings = candidates.filter((heading) => {
        if (!ids.has(heading.id) || seen.has(heading.id)) return false;
        seen.add(heading.id);
        return true;
      });
      setEntries((previous) =>
        JSON.stringify(previous) === JSON.stringify(found) ? previous : found,
      );
      schedule();
    };
    const bodyObserver = new MutationObserver(collect);
    const resizeObserver = new ResizeObserver(collect);
    const locate = () => {
      const current = container.querySelector<HTMLElement>("[data-study-body]");
      if (!current || current === body) return;
      bodyObserver.disconnect();
      resizeObserver.disconnect();
      body = current;
      bodyObserver.observe(body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["hidden", "style", "class", "aria-hidden"],
      });
      resizeObserver.observe(body);
      collect();
    };
    const initialObserver = new MutationObserver(() => {
      locate();
      if (body) initialObserver.disconnect();
    });
    locate();
    if (!body)
      initialObserver.observe(container, { childList: true, subtree: true });
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", collect);
    return () => {
      bodyObserver.disconnect();
      initialObserver.disconnect();
      resizeObserver.disconnect();
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", collect);
    };
  }, [contentKey]);
  return (
    <div ref={root} className="reading-toc-root">
      {entries.length > 0 && (
        <details
          className="reading-toc"
          open={expanded}
          onToggle={(event) => setExpanded(event.currentTarget.open)}
        >
          <summary>
            {textFor(locale, "本章小节", "On this page")}
            <span aria-hidden="true">{expanded ? "−" : "+"}</span>
          </summary>
          <nav
            aria-label={textFor(
              locale,
              "本章小节目录",
              "Sections on this page",
            )}
          >
            <ol>
              {entries.map((entry) => (
                <li
                  key={entry.id}
                  className={
                    entry.level === 3 ? "reading-toc-subsection" : undefined
                  }
                >
                  <a
                    href={entry.href}
                    aria-current={active === entry.id ? "location" : undefined}
                  >
                    {entry.text}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </details>
      )}
    </div>
  );
}
