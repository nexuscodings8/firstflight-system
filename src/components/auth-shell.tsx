import Image from "next/image";
import { Icon } from "./icons";
export function AuthShell({ title, intro, children }: { title: string; intro: string; children: React.ReactNode }) {
  return (
    <div className="bg-mist py-10 sm:py-14">
      <div className="wrap grid gap-6 lg:grid-cols-[.9fr_1.1fr] lg:items-start">
        <aside className="rounded-3xl bg-[linear-gradient(160deg,var(--color-brand),var(--color-navy))] p-8 text-white">
          <Image src="/logo-full.png" alt="FIRST FLIGHT, Best Travel Solution Ltd" width={260} height={180} className="rounded-2xl bg-white p-3" priority />
          <h1 className="mt-6 text-3xl text-white sm:text-4xl">{title}</h1>
          <p className="mt-2 text-white/90">{intro}</p>
          <ul className="mt-6 grid gap-3">
            {[["file", "Track every stage of your application"], ["upload", "Upload documents to a secure checklist"], ["bell", "See updates, invoices and receipts"]].map(([i, t]) => (
              <li key={t} className="flex items-center gap-3 font-medium"><span className="grid size-9 place-items-center rounded-lg bg-white/15 text-gold"><Icon name={i} /></span>{t}</li>
            ))}
          </ul>
        </aside>
        <div className="card p-6 sm:p-8">{children}</div>
      </div>
    </div>
  );
}
