"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";
import { api, errorMessage, fieldErrors, type ApiResult } from "@/lib/client";
import { useCountdown } from "@/hooks/useCountdown";
import { Field } from "./Field";

type Step = "phone" | "code" | "password" | "done";

export function ForgotPasswordForm() {
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [cooldown, setCooldown] = useCountdown(0);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    setErrors({});
    await action();
    setBusy(false);
  }

  const fail = (r: ApiResult) => {
    setErrors(fieldErrors(r));
    if (r.data?.error?.code !== "VALIDATION_ERROR") setError(errorMessage(r));
  };

  const requestCode = (e?: FormEvent) => {
    e?.preventDefault();
    return run(async () => {
      const r = await api("/api/auth/request-password-reset", { body: { phone } });
      if (!r.ok) return fail(r);
      setCooldown(r.data.resendAfterSeconds ?? 30);
      setStep("code");
    });
  };

  const verifyCode = (e: FormEvent) => {
    e.preventDefault();
    return run(async () => {
      const r = await api("/api/auth/verify-password-reset", { body: { phone, code } });
      if (!r.ok) return fail(r);
      setResetToken(r.data.resetToken);
      setStep("password");
    });
  };

  const submitPassword = (e: FormEvent) => {
    e.preventDefault();
    return run(async () => {
      const r = await api("/api/auth/reset-password", { body: { resetToken, newPassword } });
      if (!r.ok) {
        if (r.data?.error?.code === "INVALID_RESET_TOKEN") {
          setStep("phone");
          setCode("");
          setNewPassword("");
        }
        const f = fieldErrors(r);
        setErrors({ newPassword: f.newPassword ?? [] });
        if (r.data?.error?.code !== "VALIDATION_ERROR") setError(errorMessage(r));
        return;
      }
      setStep("done");
    });
  };

  const errorBlock = error && (
    <p className="form-error" role="alert">
      {error}
    </p>
  );

  if (step === "done") {
    return (
      <>
        <p className="form-notice" role="status">
          Your password has been changed.
        </p>
        <Link href="/login" className="btn btn-primary btn-block">
          Sign in
        </Link>
      </>
    );
  }

  if (step === "phone") {
    return (
      <form onSubmit={requestCode} noValidate>
        <Field label="Registered phone number" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} error={errors.phone?.[0]} required />
        {errorBlock}
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? "Sending…" : "Send reset code"}
        </button>
      </form>
    );
  }

  if (step === "code") {
    return (
      <form onSubmit={verifyCode} noValidate>
        <Field
          label="6-digit code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          hint="If this number has an account, a code is on its way on WhatsApp."
          autoFocus
          required
        />
        {errorBlock}
        <button className="btn btn-primary btn-block" disabled={busy || code.length !== 6}>
          {busy ? "Checking…" : "Verify code"}
        </button>
        <button type="button" className="btn btn-quiet btn-block" onClick={() => requestCode()} disabled={cooldown > 0 || busy}>
          {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={submitPassword} noValidate>
      <Field
        label="New password"
        type="password"
        autoComplete="new-password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        error={errors.newPassword?.[0]}
        hint="At least 8 characters, with a letter and a number."
        autoFocus
        required
      />
      {errorBlock}
      <button className="btn btn-primary btn-block" disabled={busy}>
        {busy ? "Saving…" : "Set new password"}
      </button>
    </form>
  );
}
