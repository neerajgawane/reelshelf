import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { AuthShell } from "@/components/AuthShell";
import { VerifyPhoneForm } from "@/components/VerifyPhoneForm";

export const metadata: Metadata = { title: "Verify your phone" };

export default async function VerifyPhonePage({ searchParams }: { searchParams: Promise<{ phone?: string }> }) {
  const { phone } = await searchParams;
  if (!phone) redirect("/signup");
  return (
    <AuthShell title="Check WhatsApp" subtitle="Enter the code we sent to confirm this number is yours.">
      <VerifyPhoneForm phone={phone} />
    </AuthShell>
  );
}
