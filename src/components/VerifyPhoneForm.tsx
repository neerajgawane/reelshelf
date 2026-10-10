"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { api, errorMessage } from "@/lib/client";
import { useCountdown } from "@/hooks/useCountdown";
import { Field } from "./Field";

export function VerifyPhoneForm({ phone }: { phone: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cooldown, setCooldown] = useCountdown(30);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    const r = await api("/api/auth/verify-phone", { body: { phone, code } });
    if (r.ok) {
      router.replace("/discover");
      router.refresh();
      return;
    }
    setBusy(false);
    setError(errorMessage(r));
  }

  async function resend() {
    setError(null);
    setNotice(null);
    setCode("");
    const r = await api("/api/auth/resend-phone-otp", { body: { phone } });
    if (r.ok) {
      setCooldown(r.data.resendAfterSeconds ?? 30);
      setNotice("New code sent. It expires in 5 minutes.");
    } else {
      if (r.status === 429) setCooldown(r.data?.error?.retryAfterSeconds ?? 30);
      setError(errorMessage(r));
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <Field
        label="6-digit code"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        hint={`Sent on WhatsApp to ${phone}. It expires in 5 minutes.`}
        autoFocus
        required
      />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="form-notice" role="status">
          {notice}
        </p>
      )}
      <button className="btn btn-primary btn-block" disabled={busy || code.length !== 6}>
        {busy ? "Verifying…" : "Verify and continue"}
      </button>
      <button type="button" className="btn btn-quiet btn-block" onClick={resend} disabled={cooldown > 0}>
        {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
      </button>
    </form>
  );
}
