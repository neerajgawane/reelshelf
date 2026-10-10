// Server-only. Docs: https://www.wapix.sbs/docs  (POST /send/otp, api_key in JSON body)

export async function sendWhatsappOtp(phoneE164: string, code: string): Promise<void> {
  const apiKey = process.env.WAPIX_API_KEY;

  if (!apiKey) {
    if (process.env.NODE_ENV !== "production" && process.env.OTP_DEV_LOG === "true") {
      console.log(`[dev] OTP for ${phoneE164}: ${code}`);
      return;
    }
    throw new Error("WAPIX_API_KEY is not configured.");
  }

  const baseUrl = process.env.WAPIX_BASE_URL ?? "https://api.wapix.sbs/api/v1";
  const res = await fetch(`${baseUrl}/send/otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service: "otp",
      // "whatsaap_number" (sic) is the field name in Wapix's API. Digits only, no "+".
      whatsaap_number: phoneE164.replace(/^\+/, ""),
      otp: code,
      text: "Your Reelshelf verification code is:",
      api_key: apiKey,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) throw new Error(`Wapix responded with HTTP ${res.status}`);
  const body = (await res.json().catch(() => null)) as { success?: boolean } | null;
  if (body && body.success === false) throw new Error("Wapix reported a delivery failure.");
}
