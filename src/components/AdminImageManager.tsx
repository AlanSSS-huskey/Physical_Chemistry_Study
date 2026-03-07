"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Image from "next/image";

type ImageItem = {
  id: string;
  url: string;
  filename: string;
  size: number;
  createdAt: string;
};

export function AdminImageManager({ items }: { items: ImageItem[] }) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState("");
  const [message, setMessage] = useState("");

  async function onDelete(id: string) {
    setLoadingId(id);
    setMessage("");
    try {
      const res = await fetch(`/api/images/${id}`, { method: "DELETE" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Delete failed");
      }
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "删除失败");
    } finally {
      setLoadingId("");
    }
  }

  return (
    <div className="space-y-4">
      {message && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {message}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <div key={item.id} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <Image
              src={item.url}
              alt={item.filename}
              width={640}
              height={360}
              className="h-44 w-full rounded-lg border border-slate-200 object-cover"
            />
            <div className="space-y-1">
              <div className="truncate text-xs font-mono text-slate-500">{item.filename}</div>
              <div className="truncate text-xs text-slate-500">{item.url}</div>
              <div className="text-xs text-slate-500">
                {(item.size / 1024).toFixed(1)} KB · {new Date(item.createdAt).toLocaleString()}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(item.url);
                  setMessage("图片 URL 已复制。");
                }}
                className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                复制 URL
              </button>
              <button
                type="button"
                onClick={() => onDelete(item.id)}
                disabled={loadingId === item.id}
                className="rounded border border-rose-300 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
              >
                {loadingId === item.id ? "删除中..." : "删除"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
