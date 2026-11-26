"use client";
import { usePathname } from "next/navigation";

/** Hides the public website header and footer inside the client portal and staff dashboard, which have their own. */
export function ChromeGate({ children }: { children: React.ReactNode }) {
  const p = usePathname();
  if (p.startsWith("/portal") || p.startsWith("/staff")) return null;
  return <>{children}</>;
}
