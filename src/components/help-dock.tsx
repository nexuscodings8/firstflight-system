"use client";
// Floating help on public pages: a WhatsApp contact picker and the website assistant.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { assistantHandoff } from "@/app/assistant-actions";

type Contact = { id: string; name: string; department: string; number: string };
type Msg = { from: "me" | "bot"; text: string; links?: { label: string; href: string }[]; suggestions?: string[]; handoff?: boolean };

const HIDE_ON = ["/staff", "/billing", "/account"];

function WhatsAppIcon({ className = "size-6" }: { className?: string }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.1 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z" /></svg>;
}
function ChatIcon({ className = "size-6" }: { className?: string }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 21 12Z" /><path d="M8.5 11h.01M12 11h.01M15.5 11h.01" /></svg>;
}

const formatNumber = (n: string) => `+${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6, 9)} ${n.slice(9)}`.trim();

export function HelpDock({ contacts }: { contacts: Contact[] }) {
  const path = usePathname();
  const [open, setOpen] = useState<"wa" | "chat" | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  if (HIDE_ON.some((p) => path.startsWith(p))) return null;
  return (
    <div className="no-print fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      {open === "wa" && <WhatsAppPicker contacts={contacts} onClose={() => setOpen(null)} />}
      {open === "chat" && <Assistant onClose={() => setOpen(null)} />}
      <div className="flex gap-3">
        {contacts.length > 0 && (
          <button type="button" aria-expanded={open === "wa"} aria-controls="wa-picker" onClick={() => setOpen(open === "wa" ? null : "wa")}
            className="flex size-14 items-center justify-center rounded-full bg-[#1f8f4e] text-white shadow-lg ring-4 ring-white hover:bg-[#17773f] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-gold">
            <WhatsAppIcon className="size-7" /><span className="sr-only">Message us on WhatsApp</span>
          </button>
        )}
        <button type="button" aria-expanded={open === "chat"} aria-controls="assistant" onClick={() => setOpen(open === "chat" ? null : "chat")}
          className="flex h-14 items-center gap-2 rounded-full bg-brand px-5 font-semibold text-white shadow-lg ring-4 ring-white hover:bg-navy focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-gold">
          <ChatIcon /><span>Ask us</span>
        </button>
      </div>
    </div>
  );
}

function WhatsAppPicker({ contacts, onClose }: { contacts: Contact[]; onClose: () => void }) {
  const first = useRef<HTMLAnchorElement>(null);
  useEffect(() => { first.current?.focus(); }, []);
  const link = (n: string) => {
    const page = typeof document !== "undefined" ? document.title.replace(/ \| FIRST FLIGHT$/, "") : "";
    const url = typeof location !== "undefined" ? location.href : "";
    const text = `Hello FIRST FLIGHT, I have a question${page ? ` about "${page}"` : ""}.${url ? `\n${url}` : ""}`;
    return `https://wa.me/${n}?text=${encodeURIComponent(text)}`;
  };
  return (
    <section id="wa-picker" role="dialog" aria-label="Choose who to message on WhatsApp" className="w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-line bg-white p-4 shadow-2xl">
      <div className="flex items-center justify-between gap-2"><h2 className="text-lg">Message us on WhatsApp</h2><button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-xl leading-none hover:bg-mist" aria-label="Close">×</button></div>
      <p className="mt-1 text-sm muted">Choose the desk that fits your question. WhatsApp opens with a message about this page.</p>
      <ul className="mt-3 space-y-2">
        {contacts.map((c, i) => (
          <li key={c.id}>
            <a ref={i === 0 ? first : undefined} href={link(c.number)} target="_blank" rel="noopener noreferrer" onClick={(e) => { e.currentTarget.href = link(c.number); }}
              className="flex items-center gap-3 rounded-xl border border-line p-3 hover:border-[#1f8f4e] hover:bg-[#1f8f4e]/5">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#1f8f4e] text-white"><WhatsAppIcon className="size-5" /></span>
              <span className="min-w-0"><span className="block font-semibold">{c.name}</span><span className="block text-sm muted">{c.department}</span><span className="block text-xs muted">{formatNumber(c.number)}</span></span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Assistant({ onClose }: { onClose: () => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([{ from: "bot", text: "Hello! I'm the FIRST FLIGHT assistant. Ask me about jobs abroad, study programs or visas, or talk to a consultant.", suggestions: ["Find jobs abroad", "Study programs", "Visa requirements", "Talk to a consultant"] }]);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState("");
  const [handoff, setHandoff] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { input.current?.focus(); }, []);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs, handoff]);

  async function send(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    setDraft("");
    setMsgs((m) => [...m, { from: "me", text: t }]);
    setBusy(true);
    try {
      const r = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: t }) });
      const reply = (await r.json()) as Msg;
      setMsgs((m) => [...m, { ...reply, from: "bot" }]);
      if (reply.handoff) setHandoff(true);
    } catch {
      setMsgs((m) => [...m, { from: "bot", text: "Sorry, I couldn't reach the server. Please try again, or use WhatsApp.", handoff: true }]);
    } finally { setBusy(false); }
  }
  const transcript = msgs.map((m) => `${m.from === "me" ? "Visitor" : "Assistant"}: ${m.text}${m.links?.length ? ` [${m.links.map((l) => l.label).join("; ")}]` : ""}`).join("\n");
  const lastQuestion = [...msgs].reverse().find((m) => m.from === "me")?.text ?? "";

  return (
    <section id="assistant" role="dialog" aria-label="FIRST FLIGHT assistant" className="flex max-h-[min(36rem,calc(100vh-7rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-2xl">
      <header className="flex items-center justify-between gap-2 bg-navy px-4 py-3 text-white">
        <div><h2 className="text-base text-white">FIRST FLIGHT assistant</h2><p className="text-xs text-white/75">Answers from our live listings. A consultant is a click away.</p></div>
        <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-xl leading-none hover:bg-white/10" aria-label="Close assistant">×</button>
      </header>
      <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
        {msgs.map((m, i) => (
          <div key={i} className={m.from === "me" ? "flex justify-end" : ""}>
            <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.from === "me" ? "bg-brand text-white" : "bg-mist"}`}>
              <p className="whitespace-pre-line">{m.text}</p>
              {m.links && m.links.length > 0 && <ul className="mt-2 space-y-1">{m.links.map((l) => <li key={l.href + l.label}><Link href={l.href} onClick={onClose} className="font-semibold text-brand underline">{l.label}</Link></li>)}</ul>}
            </div>
            {m.from === "bot" && m.suggestions && i === msgs.length - 1 && !handoff && (
              <div className="mt-2 flex flex-wrap gap-1.5">{m.suggestions.map((s) => <button key={s} type="button" onClick={() => send(s)} className="rounded-full border border-brand/30 px-3 py-1 text-xs font-semibold text-brand hover:bg-brand hover:text-white">{s}</button>)}</div>
            )}
          </div>
        ))}
        {busy && <p className="text-sm muted">Looking that up…</p>}
        {handoff && <HandoffForm transcript={transcript} question={lastQuestion} />}
        <div ref={end} />
      </div>
      <form className="flex gap-2 border-t border-line p-3" onSubmit={(e) => { e.preventDefault(); send(draft); }}>
        <label htmlFor="assistant-input" className="sr-only">Your question</label>
        <input id="assistant-input" ref={input} value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={500} placeholder="e.g. nursing jobs in Canada" className="input min-h-10 flex-1 py-2" autoComplete="off" />
        <button className="btn-primary btn-sm" disabled={busy || !draft.trim()}>Send</button>
      </form>
      {!handoff && <button type="button" onClick={() => setHandoff(true)} className="border-t border-line py-2 text-xs font-semibold text-brand hover:bg-mist">Talk to a consultant instead</button>}
    </section>
  );
}

function HandoffForm({ transcript, question }: { transcript: string; question: string }) {
  const [state, run, pending] = useActionState(assistantHandoff, undefined);
  if (state?.ok) return <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-800">{state.ok}</p>;
  return (
    <form className="grid gap-2 rounded-xl border border-line p-3" onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => run(fd)); }}>
      <p className="text-sm font-semibold">Leave your details for a consultant</p>
      <input type="hidden" name="transcript" value={transcript} />
      <input type="hidden" name="page" value={typeof location !== "undefined" ? location.pathname : ""} />
      <label className="sr-only" htmlFor="ho-name">Your name</label><input id="ho-name" name="name" required placeholder="Your name" autoComplete="name" className="input min-h-10 py-2" />
      <label className="sr-only" htmlFor="ho-email">Email</label><input id="ho-email" name="email" type="email" required placeholder="Email" autoComplete="email" className="input min-h-10 py-2" />
      <label className="sr-only" htmlFor="ho-phone">Phone or WhatsApp (optional)</label><input id="ho-phone" name="phone" type="tel" placeholder="Phone or WhatsApp (optional)" autoComplete="tel" className="input min-h-10 py-2" />
      <label className="sr-only" htmlFor="ho-msg">What do you need help with?</label><textarea id="ho-msg" name="message" required rows={3} defaultValue={question} placeholder="What do you need help with?" className="input py-2" />
      <button className="btn-primary btn-sm" disabled={pending}>{pending ? "Sending…" : "Send to a consultant"}</button>
      {state?.error && <p role="alert" className="text-sm font-medium text-red-700">{state.error}</p>}
    </form>
  );
}
