"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, errorMessage, fieldErrors } from "@/lib/client";
import { useCountdown } from "@/hooks/useCountdown";
import { Field } from "./Field";

type Mode = "password" | "otp";

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [cooldown, setCooldown] = useCountdown(0);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setErrors({});
  }

  function done() {
    router.replace("/discover");
    router.refresh();
  }

  async function submitPassword(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setErrors({});
    const r = await api("/api/auth/login", { body: { email, password } });
    if (r.ok) return done();
    setBusy(false);
    if (r.data?.error?.code === "PHONE_NOT_VERIFIED") {
      const p: string = r.data.error.phone;
      await api("/api/auth/resend-phone-otp", { body: { phone: p } });
      router.push(`/verify-phone?phone=${encodeURIComponent(p)}`);
      return;
    }
    setErrors(fieldErrors(r));
    if (r.data?.error?.code !== "VALIDATION_ERROR") setError(errorMessage(r));
  }

  async function requestCode(e?: FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    setErrors({});
    const r = await api("/api/auth/request-login-otp", { body: { phone } });
    setBusy(false);
    if (r.ok) {
      setCodeSent(true);
      setCooldown(r.data.resendAfterSeconds ?? 30);
      return;
    }
    setErrors(fieldErrors(r));
    if (r.data?.error?.code !== "VALIDATION_ERROR") setError(errorMessage(r));
  }

  async function submitCode(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await api("/api/auth/verify-login-otp", { body: { phone, code } });
    if (r.ok) return done();
    setBusy(false);
    setError(errorMessage(r));
  }

  return (
    <>
      <div className="tabs" role="tablist" aria-label="Sign-in method">
        <button role="tab" aria-selected={mode === "password"} onClick={() => switchMode("password")} type="button">
          Email and password
        </button>
        <button role="tab" aria-selected={mode === "otp"} onClick={() => switchMode("otp")} type="button">
          Phone and code
        </button>
      </div>

      {mode === "password" ? (
        <form onSubmit={submitPassword} noValidate>
          <Field label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email?.[0]} required />
          <Field label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
          <p className="aside">
            <Link href="/forgot-password">Forgot your password?</Link>
          </p>
        </form>
      ) : !codeSent ? (
        <form onSubmit={requestCode} noValidate>
          <Field
            label="Phone number"
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            error={errors.phone?.[0]}
            hint="We'll send a sign-in code on WhatsApp."
            required
          />
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy ? "Sending…" : "Send code"}
          </button>
        </form>
      ) : (
        <form onSubmit={submitCode} noValidate>
          <Field
            label="6-digit code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            hint="If this number has an account, a code is on its way. It expires in 5 minutes."
            autoFocus
            required
          />
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="btn btn-primary btn-block" disabled={busy || code.length !== 6}>
            {busy ? "Verifying…" : "Sign in"}
          </button>
          <button type="button" className="btn btn-quiet btn-block" onClick={() => requestCode()} disabled={cooldown > 0 || busy}>
            {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
          </button>
        </form>
      )}
    </>
  );
}
