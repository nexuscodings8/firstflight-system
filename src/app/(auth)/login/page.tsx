import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { homeFor } from "@/lib/permissions";
import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const u = await getCurrentUser();
  if (u) redirect(homeFor(u.role));
  return (
    <AuthShell title="Welcome back" intro="Sign in to follow your applications and documents.">
      <h2 className="text-2xl">Sign in</h2>
      {next?.startsWith("/apply") && <p className="mt-2 rounded-xl bg-gold/15 p-3 text-sm">Sign in or create an account to finish your application. Your selection is kept.</p>}
      <div className="mt-5"><LoginForm next={next} /></div>
      <p className="mt-5 text-sm">New to FIRST FLIGHT? <Link className="font-semibold text-brand underline" href={`/register${next ? `?next=${encodeURIComponent(next)}` : ""}`}>Create an account</Link></p>
    </AuthShell>
  );
}
