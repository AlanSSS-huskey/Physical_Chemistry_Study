import test from "node:test";
import assert from "node:assert/strict";
import { renderMarkdown, normalizeMath } from "../src/lib/markdown.ts";

test("legacy mathematical delimiters render alongside standard Markdown math", async () => {
  const html = await renderMarkdown(
    "# Energy\n\n\\(PV = nRT\\)\n\n\\[\nH = U + PV\n\\]",
  );
  assert.match(html, /<h1>Energy<\/h1>/);
  assert.match(html, /class="katex"/);
  assert.match(html, /katex-display/);
});

test("stored content cannot execute scripts, JSX, or unsafe links", async () => {
  const html = await renderMarkdown(
    '<script>alert(1)</script>\n\n[click](javascript:alert%281%29)\n\n{process.env.SECRET}\n\n<img src=x onerror="alert(1)">',
  );
  assert.doesNotMatch(html, /<script|onerror=|href="javascript:/);
  assert.match(html, /process.env.SECRET/);
});

test("math normalization leaves fenced and inline code intact", () => {
  const source = "`\\(code\\)`\n\n```tex\n\\[code\\]\n```\n\n\\(x\\)";
  const output = normalizeMath(source);
  assert.match(output, /`\\\(code\\\)`/);
  assert.match(output, /```tex\n\\\[code\\\]\n```/);
  assert.match(output, /\$x\$/);
});
