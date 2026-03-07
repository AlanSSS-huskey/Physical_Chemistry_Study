"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MDXRemote } from "next-mdx-remote";
import type { MDXRemoteSerializeResult } from "next-mdx-remote";

type Props = {
  contentId?: string;
  initialTitle?: string;
  initialSlug?: string;
  initialModule?: string;
  initialBody?: string;
  moduleOptions?: string[];
};

type PreviewResponse = {
  mdx: MDXRemoteSerializeResult<Record<string, unknown>>;
};

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function AdminContentEditor({
  contentId,
  initialTitle = "",
  initialSlug = "",
  initialModule = "",
  initialBody = "",
  moduleOptions = []
}: Props) {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [title, setTitle] = useState(initialTitle);
  const [slug, setSlug] = useState(initialSlug);
  const [moduleValue, setModuleValue] = useState(initialModule);
  const [body, setBody] = useState(initialBody);
  const [preview, setPreview] = useState<PreviewResponse["mdx"] | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [saveError, setSaveError] = useState("");

  const updatePreview = useCallback(async (nextBody: string) => {
    try {
      const res = await fetch("/api/admin/preview-mdx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: nextBody })
      });
      if (!res.ok) {
        throw new Error("Preview failed");
      }
      const data = (await res.json()) as PreviewResponse;
      setPreview(data.mdx);
      setPreviewError("");
    } catch {
      setPreview(null);
      setPreviewError("Preview 渲染失败，请检查 MDX 语法。");
    }
  }, []);

  useEffect(() => {
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
    }
    previewTimerRef.current = setTimeout(() => {
      updatePreview(body);
    }, 280);
    return () => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    };
  }, [body, updatePreview]);

  function insertAtCursor(text: string) {
    const el = textareaRef.current;
    if (!el) {
      setBody((prev) => `${prev}${text}`);
      return;
    }

    const start = el.selectionStart;
    const end = el.selectionEnd;
    const before = body.slice(0, start);
    const after = body.slice(end);
    const next = `${before}${text}${after}`;
    setBody(next);

    requestAnimationFrame(() => {
      el.focus();
      const cursor = start + text.length;
      el.selectionStart = cursor;
      el.selectionEnd = cursor;
    });
  }

  async function uploadImage(file: File) {
    if (!file.type.startsWith("image/")) return;
    const formData = new FormData();
    formData.append("file", file);

    setIsUploading(true);
    setSaveError("");
    try {
      const res = await fetch("/api/upload-image", {
        method: "POST",
        body: formData
      });

      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Upload failed");
      }

      const markdown = `\n![${file.name || "image"}](${data.url})\n`;
      insertAtCursor(markdown);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "上传图片失败");
    } finally {
      setIsUploading(false);
      setDragging(false);
    }
  }

  async function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSaving(true);
    setSaveError("");
    try {
      const targetSlug = slug || slugify(title);
      const endpoint = contentId ? `/api/admin/content/${contentId}` : "/api/admin/content";
      const method = contentId ? "PUT" : "POST";
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          slug: targetSlug,
          module: moduleValue,
          body
        })
      });

      const data = (await res.json()) as { id?: string; error?: string };
      if (!res.ok || !data.id) {
        throw new Error(data.error || "保存失败");
      }

      router.push(`/admin/edit/${data.id}?saved=1`);
      router.refresh();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "保存失败");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={onSave} className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (!slug) {
              setSlug(slugify(e.target.value));
            }
          }}
          required
          placeholder="Title"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          value={slug}
          onChange={(e) => setSlug(slugify(e.target.value))}
          required
          placeholder="Slug"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          value={moduleValue}
          onChange={(e) => setModuleValue(e.target.value)}
          list="module-options"
          placeholder="Module / Subject"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <datalist id="module-options">
        {moduleOptions.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold text-slate-700">
              Markdown / MDX 编辑器
            </div>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadImage(file);
                  e.currentTarget.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                上传图片
              </button>
            </div>
          </div>

          <div className="relative">
            <textarea
              ref={textareaRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (file) uploadImage(file);
              }}
              onPaste={(e) => {
                const item = [...e.clipboardData.items].find((it) =>
                  it.type.startsWith("image/")
                );
                if (!item) return;
                const file = item.getAsFile();
                if (!file) return;
                e.preventDefault();
                uploadImage(file);
              }}
              className="min-h-[560px] w-full rounded-lg border border-slate-300 px-3 py-3 font-mono text-sm outline-none ring-offset-2 focus:ring-2 focus:ring-blue-300"
              placeholder={"# 在这里写内容\n\n支持 Markdown / MDX / KaTeX。\n\n例如：\n\n$$E = mc^2$$"}
            />
            {dragging && (
              <div className="pointer-events-none absolute inset-0 grid place-items-center rounded-lg border-2 border-dashed border-blue-400 bg-blue-50/90 text-sm font-semibold text-blue-700">
                Drop image to upload
              </div>
            )}
          </div>
          <div className="text-xs text-slate-500">
            支持拖拽上传、粘贴截图上传、按钮上传。图片会自动插入 Markdown。
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-semibold text-slate-700">Preview</div>
          <div className="min-h-[560px] rounded-lg border border-slate-300 bg-white p-4">
            {previewError ? (
              <div className="rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                {previewError}
              </div>
            ) : preview ? (
              <div className="prose prose-slate max-w-none text-slate-700">
                <MDXRemote {...preview} />
              </div>
            ) : (
              <div className="text-sm text-slate-500">渲染中...</div>
            )}
          </div>
        </div>
      </div>

      {(saveError || isUploading) && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {isUploading ? "图片上传中..." : saveError}
        </div>
      )}

      <button
        type="submit"
        disabled={isSaving}
        className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSaving ? "保存中..." : "保存文章"}
      </button>
    </form>
  );
}
