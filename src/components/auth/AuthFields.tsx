"use client";

import { useId, useState, type InputHTMLAttributes } from "react";
import { useLocale } from "@/components/LocaleProvider";
import { textFor } from "@/lib/i18n";

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
};

export function AuthField({ label, hint, id, ...props }: FieldProps) {
  const generated = useId();
  const fieldId = id ?? generated;
  return (
    <div className="auth-field">
      <label htmlFor={fieldId}>{label}</label>
      <input
        {...props}
        id={fieldId}
        className="input"
        aria-describedby={hint ? `${fieldId}-hint` : props["aria-describedby"]}
      />
      {hint && (
        <p id={`${fieldId}-hint`} className="auth-hint">
          {hint}
        </p>
      )}
    </div>
  );
}

export function PasswordField({ label, hint, id, ...props }: FieldProps) {
  const { locale } = useLocale();
  const generated = useId();
  const fieldId = id ?? generated;
  const [visible, setVisible] = useState(false);
  return (
    <div className="auth-field">
      <label htmlFor={fieldId}>{label}</label>
      <div className="auth-password">
        <input
          {...props}
          id={fieldId}
          type={visible ? "text" : "password"}
          className="input"
          aria-describedby={
            hint ? `${fieldId}-hint` : props["aria-describedby"]
          }
        />
        <button
          type="button"
          className="auth-reveal"
          onClick={() => setVisible(!visible)}
          aria-pressed={visible}
          aria-label={textFor(
            locale,
            visible ? `隐藏${label}` : `显示${label}`,
            `${visible ? "Hide" : "Show"} ${label.toLowerCase()}`,
          )}
        >
          {textFor(
            locale,
            visible ? "隐藏" : "显示",
            visible ? "Hide" : "Show",
          )}
        </button>
      </div>
      {hint && (
        <p id={`${fieldId}-hint`} className="auth-hint">
          {hint}
        </p>
      )}
    </div>
  );
}

export function RememberChoice({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  const { locale } = useLocale();
  const id = useId();
  const t = (zh: string, en: string) => textFor(locale, zh, en);
  return (
    <div className="auth-remember">
      <label>
        <input
          type="checkbox"
          name="remember"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          aria-describedby={`${id}-hint`}
        />
        <span>{t("记住我，保留登录 30 天", "Remember me for 30 days")}</span>
      </label>
      <p id={`${id}-hint`} className="auth-hint">
        {checked
          ? t(
              "仅在自己的设备上使用此选项。",
              "Use this option only on your own device.",
            )
          : t(
              "本次浏览器会话有效，最长 12 小时。",
              "For this browser session, for up to 12 hours.",
            )}
      </p>
    </div>
  );
}

export function AuthFeedback({
  message,
  success = false,
}: {
  message: string;
  success?: boolean;
}) {
  if (!message) return null;
  return (
    <div
      className={`notice auth-feedback ${success ? "auth-feedback-success" : "notice-error"}`}
      role={success ? "status" : "alert"}
      tabIndex={-1}
    >
      <span aria-hidden="true">{success ? "✓" : "!"}</span>
      <p>{message}</p>
    </div>
  );
}
