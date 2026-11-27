"use client";
import { useEffect, useState } from "react";

/** Announces a server action's confirmation even when the form that sent it disappears after the page refreshes. */
export function flash(text: string) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("ff-flash", { detail: text }));
}

export function FlashHost() {
  const [msg, setMsg] = useState<{ text: string; n: number } | null>(null);
  useEffect(() => {
    const on = (e: Event) => setMsg((m) => ({ text: (e as CustomEvent<string>).detail, n: (m?.n ?? 0) + 1 }));
    window.addEventListener("ff-flash", on);
    return () => window.removeEventListener("ff-flash", on);
  }, []);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 6000);
    return () => clearTimeout(t);
  }, [msg]);
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      {msg && <p key={msg.n} role="status" data-testid="flash" className="pointer-events-auto rounded-xl bg-emerald-700 px-4 py-3 text-sm font-medium text-white shadow-lg">{msg.text}</p>}
    </div>
  );
}
