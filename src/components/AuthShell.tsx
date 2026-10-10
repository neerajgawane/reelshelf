import Link from "next/link";
import { ReactNode } from "react";

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <main className="auth">
      <Link href="/" className="wordmark">
        Reelshelf
      </Link>
      <h1>{title}</h1>
      {subtitle && <p className="subtitle">{subtitle}</p>}
      {children}
      {footer && <p className="auth-footer">{footer}</p>}
    </main>
  );
}
