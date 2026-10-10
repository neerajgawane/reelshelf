"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { api, errorMessage, fieldErrors } from "@/lib/client";
import { Field } from "./Field";

export function SignupForm() {
  const router = useRouter();
  const [values, setValues] = useState({ name: "", email: "", password: "", phone: "" });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const set = (key: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) => setValues((v) => ({ ...v, [key]: e.target.value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormError(null);
    setErrors({});
    const r = await api("/api/auth/signup", { body: values });
    setBusy(false);
    if (r.ok) {
      router.push(`/verify-phone?phone=${encodeURIComponent(r.data.phone)}`);
      return;
    }
    setErrors(fieldErrors(r));
    setFormError(r.data?.error?.code === "VALIDATION_ERROR" ? null : errorMessage(r));
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <Field label="Name" autoComplete="name" value={values.name} onChange={set("name")} error={errors.name?.[0]} required />
      <Field label="Email" type="email" autoComplete="email" value={values.email} onChange={set("email")} error={errors.email?.[0]} required />
      <Field
        label="Phone number"
        type="tel"
        autoComplete="tel"
        value={values.phone}
        onChange={set("phone")}
        error={errors.phone?.[0]}
        hint="We'll send a code to this number on WhatsApp. Include the country code if it isn't India."
        required
      />
      <Field
        label="Password"
        type="password"
        autoComplete="new-password"
        value={values.password}
        onChange={set("password")}
        error={errors.password?.[0]}
        hint="At least 8 characters, with a letter and a number."
        required
      />
      {formError && (
        <p className="form-error" role="alert">
          {formError}
        </p>
      )}
      <button className="btn btn-primary btn-block" disabled={busy}>
        {busy ? "Sending code…" : "Create account"}
      </button>
    </form>
  );
}
