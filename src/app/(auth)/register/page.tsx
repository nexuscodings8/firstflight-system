import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { RegisterForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Create an account" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <AuthShell title="Your client portal" intro="Create an account to apply and track every step with a consultant.">
      <h2 className="text-2xl">Create an account</h2>
      <div className="mt-5"><RegisterForm next={next} /></div>
      <p className="mt-5 text-sm">Already have an account? <Link className="font-semibold text-brand underline" href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`}>Sign in</Link></p>
    </AuthShell>
  );
}
