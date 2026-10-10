import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Landing() {
  if (await getCurrentUser()) redirect("/discover");
  return (
    <main className="landing">
      <p className="wordmark">Reelshelf</p>
      <h1>Find a movie. Keep it on your shelf.</h1>
      <p className="subtitle">Browse what&rsquo;s popular, search any title, and save the ones you want to watch. Your shelf follows you to any device.</p>
      <div className="landing-actions">
        <Link href="/signup" className="btn btn-primary">
          Create account
        </Link>
        <Link href="/login" className="btn">
          Sign in
        </Link>
      </div>
    </main>
  );
}
