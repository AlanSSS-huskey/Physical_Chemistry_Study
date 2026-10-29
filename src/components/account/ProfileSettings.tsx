"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/components/LocaleProvider";
import { textFor } from "@/lib/i18n";
import {
  AccountRequestError,
  accountErrorMessage,
  accountRequest,
} from "@/components/auth/account-client";
import { AuthFeedback, AuthField } from "@/components/auth/AuthFields";
import type { AccountProfile } from "./account-types";

export function ProfileSettings({
  profile,
  onChange,
}: {
  profile: AccountProfile;
  onChange: (changes: Partial<AccountProfile>) => void;
}) {
  const { locale } = useLocale();
  const t = (zh: string, en: string) => textFor(locale, zh, en);
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(profile.name ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [avatarPending, setAvatarPending] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const [avatarSaved, setAvatarSaved] = useState(false);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setSaved(false);
    try {
      const result = await accountRequest<{ ok: true; data?: AccountProfile }>(
        "/api/account/profile",
        { method: "PATCH", body: { name } },
      );
      onChange({ name: result.data?.name ?? name.trim() });
      setSaved(true);
      router.refresh();
    } catch (reason) {
      setError(accountErrorMessage(reason, locale));
    } finally {
      setPending(false);
    }
  }

  function chooseFile(next: File | null) {
    setAvatarError("");
    setAvatarSaved(false);
    setFile(null);
    if (!next) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(next.type)) {
      setAvatarError(
        accountErrorMessage(
          new AccountRequestError("INVALID_FILE_TYPE"),
          locale,
        ),
      );
      if (fileInput.current) fileInput.current.value = "";
      return;
    }
    if (next.size > 4 * 1024 * 1024) {
      setAvatarError(
        accountErrorMessage(new AccountRequestError("FILE_TOO_LARGE"), locale),
      );
      if (fileInput.current) fileInput.current.value = "";
      return;
    }
    setFile(next);
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;
    setAvatarPending(true);
    setAvatarError("");
    setAvatarSaved(false);
    const body = new FormData();
    body.append("file", file);
    try {
      const result = await accountRequest<{
        ok: true;
        data: { image: string };
      }>("/api/account/avatar", { method: "POST", body });
      onChange({ image: result.data.image });
      setFile(null);
      setAvatarSaved(true);
      if (fileInput.current) fileInput.current.value = "";
      router.refresh();
    } catch (reason) {
      setAvatarError(accountErrorMessage(reason, locale));
    } finally {
      setAvatarPending(false);
    }
  }

  const avatar = preview || profile.image;
  return (
    <section
      className="account-section"
      id="profile"
      aria-labelledby="profile-heading"
    >
      <header>
        <p className="eyebrow">01 · {t("个人资料", "PROFILE")}</p>
        <h2 id="profile-heading">{t("关于你", "Make yourself at home")}</h2>
        <p className="muted">
          {t(
            "选择你希望显示的名称和头像。",
            "Choose the name and picture you would like to use.",
          )}
        </p>
      </header>
      <div className="account-section-body">
        <form
          className="account-avatar-form"
          onSubmit={upload}
          aria-busy={avatarPending}
        >
          <div
            className="account-avatar"
            aria-label={t("头像", "Profile picture")}
          >
            {avatar ? (
              <Image
                src={avatar}
                alt={
                  preview
                    ? t(
                        "新头像预览，尚未保存",
                        "New profile picture preview, not yet saved",
                      )
                    : t("当前头像", "Current profile picture")
                }
                width={88}
                height={88}
                unoptimized
              />
            ) : (
              <span aria-hidden="true">
                {(profile.name || profile.email || "ψ")
                  .slice(0, 1)
                  .toUpperCase()}
              </span>
            )}
          </div>
          <div className="account-avatar-controls">
            <label htmlFor="account-avatar-file">
              {t("账户头像", "Profile picture")}
            </label>
            <p id="avatar-file-hint" className="auth-hint">
              {t(
                "PNG、JPEG 或 WebP，最大 4 MB。",
                "PNG, JPEG or WebP, up to 4 MB.",
              )}
            </p>
            <input
              ref={fileInput}
              id="account-avatar-file"
              className="account-file-input"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={avatarPending}
              onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
              aria-describedby="avatar-file-hint"
            />
            {file && (
              <div className="account-avatar-actions">
                <button
                  className="button-secondary"
                  type="submit"
                  disabled={avatarPending}
                >
                  {avatarPending
                    ? t("正在上传…", "Uploading…")
                    : t("保存新头像", "Save new picture")}
                </button>
                <button
                  className="button-ghost"
                  type="button"
                  disabled={avatarPending}
                  onClick={() => {
                    setFile(null);
                    if (fileInput.current) fileInput.current.value = "";
                  }}
                >
                  {t("取消", "Cancel")}
                </button>
                <span className="auth-hint">
                  {t("预览，尚未保存", "Preview, not saved yet")}
                </span>
              </div>
            )}
          </div>
        </form>
        <AuthFeedback message={avatarError} />
        {avatarSaved && (
          <AuthFeedback
            success
            message={t(
              "头像已更新。",
              "Your profile picture has been updated.",
            )}
          />
        )}
        <form
          className="auth-form account-profile-form"
          onSubmit={save}
          aria-busy={pending}
        >
          <AuthField
            label={t("显示名称", "Display name")}
            name="name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setSaved(false);
            }}
            required
            maxLength={80}
            autoComplete="nickname"
            disabled={pending}
          />
          <AuthField
            label={t("邮箱", "Email address")}
            name="email"
            type="email"
            value={profile.email ?? ""}
            readOnly
            autoComplete="email"
            hint={t(
              "邮箱用于登录和账户安全验证。",
              "Your email is used for sign-in and account security.",
            )}
          />
          <p
            className={`account-verification ${profile.emailVerified ? "is-verified" : profile.googleLinked ? "is-provider" : ""}`}
          >
            {profile.emailVerified ? (
              <>
                <span aria-hidden="true">✓</span>{" "}
                {t("邮箱已验证", "Email verified")}
              </>
            ) : profile.googleLinked ? (
              <>
                {t(
                  "邮箱由 Google 账号提供",
                  "Email provided by your Google account",
                )}
              </>
            ) : (
              <>
                <span aria-hidden="true">○</span>{" "}
                {t("邮箱尚未验证", "Email not yet verified")} ·{" "}
                <Link href="/verify-email">
                  {t("验证邮箱", "Verify email")}
                </Link>
              </>
            )}
          </p>
          <AuthFeedback message={error} />
          {saved && (
            <AuthFeedback
              success
              message={t(
                "显示名称已保存。",
                "Your display name has been saved.",
              )}
            />
          )}
          <div>
            <button
              className="button"
              type="submit"
              disabled={pending || name.trim() === (profile.name ?? "")}
            >
              {pending
                ? t("正在保存…", "Saving…")
                : t("保存资料", "Save profile")}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
