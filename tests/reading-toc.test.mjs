import test from "node:test";
import assert from "node:assert/strict";
import {
  readingTocEntries,
  activeReadingSection,
  readingHeadingLabel,
} from "../src/lib/reading-toc.ts";

const element = (tag, attributes, ...children) => ({
  tag,
  attributes,
  children,
});

test("the final visible section becomes active at the document bottom even when anchor scrolling is clamped", () => {
  const headings = [
    { id: "start", top: -200 },
    { id: "reversible", top: 80 },
    { id: "equilibrium", top: 260 },
  ];
  assert.equal(
    activeReadingSection(headings, 140, {
      atEnd: true,
      scrollY: 420,
      height: 700,
    }),
    "equilibrium",
  );
  assert.equal(
    activeReadingSection(headings, 140, {
      atEnd: false,
      scrollY: 420,
      height: 700,
    }),
    "reversible",
  );
  assert.equal(
    activeReadingSection(
      [
        { id: "first", top: 200 },
        { id: "last", top: 500 },
      ],
      140,
      { atEnd: true, scrollY: 0, height: 700 },
    ),
    "first",
  );
});

test("rendered math contributes one TeX annotation, without duplicate MathML or visual text", () => {
  const heading = element(
    "h2",
    {},
    "自由能 ",
    element(
      "span",
      { class: "katex" },
      element(
        "span",
        { class: "katex-mathml" },
        element(
          "math",
          {},
          element(
            "semantics",
            {},
            element("mrow", {}, "ΔG"),
            element(
              "annotation",
              { encoding: "application/x-tex" },
              "\\Delta G",
            ),
          ),
        ),
      ),
      element("span", { class: "katex-html", "aria-hidden": "true" }, "ΔG"),
    ),
    " 与平衡",
  );
  assert.equal(readingHeadingLabel(heading), "自由能 \\Delta G 与平衡");
});

test("outline labels omit generated footnotes and screen-reader-only headings, retaining scientific superscripts", () => {
  assert.equal(
    readingHeadingLabel(
      element(
        "h2",
        {},
        "Energy",
        element(
          "sup",
          {},
          element(
            "a",
            { "data-footnote-ref": "", href: "#user-content-fn-1" },
            "1",
          ),
        ),
      ),
    ),
    "Energy",
  );
  assert.equal(
    readingHeadingLabel(element("h2", {}, "Rate k", element("sup", {}, "2"))),
    "Rate k2",
  );
  assert.equal(
    readingHeadingLabel(element("h2", { class: "sr-only" }, "Footnotes")),
    "",
  );
  assert.equal(
    readingHeadingLabel(
      element(
        "h3",
        {},
        "Visible ",
        element("span", { class: "visually-hidden" }, "hidden duplicate"),
        element("span", { "aria-hidden": "true" }, "hidden"),
      ),
    ),
    "Visible",
  );
});

test("the chapter outline includes only visible h2/h3 headings with unique usable identities", () => {
  const items = readingTocEntries([
    { id: "section-intro", text: "  Introduction  ", level: 2, visible: true },
    { id: "section-intro", text: "Duplicate", level: 2, visible: true },
    { id: "hidden", text: "Gated heading", level: 2, visible: false },
    { id: "title", text: "Article title", level: 1, visible: true },
    { id: "detail", text: "Small detail", level: 4, visible: true },
    { id: "", text: "No identity", level: 2, visible: true },
    { id: "empty", text: "  ", level: 3, visible: true },
    { id: "bad\nidentity", text: "Invalid", level: 2, visible: true },
  ]);
  assert.deepEqual(items, [
    {
      id: "section-intro",
      text: "Introduction",
      level: 2,
      href: "#section-intro",
    },
  ]);
});
test("outline text keeps Unicode while fragment identities are encoded without navigation schemes", () => {
  assert.deepEqual(
    readingTocEntries([
      {
        id: "section-熵&焓",
        text: " 熵（entropy）\n与焓 ",
        level: 3,
        visible: true,
      },
    ]),
    [
      {
        id: "section-熵&焓",
        text: "熵（entropy） 与焓",
        level: 3,
        href: "#section-%E7%86%B5%26%E7%84%93",
      },
    ],
  );
  assert.equal(
    readingTocEntries([
      { id: "\ud800", text: "Malformed Unicode", level: 2, visible: true },
    ]).length,
    0,
  );
});
test("active section follows the last heading above the viewport marker and falls back to the first", () => {
  const headings = [
    { id: "first", top: -50 },
    { id: "second", top: 140 },
    { id: "third", top: 200 },
  ];
  assert.equal(activeReadingSection(headings), "second");
  assert.equal(activeReadingSection(headings, -100), "first");
  assert.equal(activeReadingSection(headings, 250), "third");
  assert.equal(activeReadingSection([]), null);
  assert.equal(
    activeReadingSection([
      { id: "", top: 0 },
      { id: "invalid", top: NaN },
    ]),
    null,
  );
});
