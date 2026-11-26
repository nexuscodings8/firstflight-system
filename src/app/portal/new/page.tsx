import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { Icon } from "@/components/icons";

export const metadata = { title: "New application" };

const CHOICES = [
  { href: "/work", icon: "briefcase", title: "Work Abroad", text: "Choose a destination, then a job offer. Apply from the job page; its document checklist comes with it." },
  { href: "/study", icon: "cap", title: "Study Abroad", text: "Choose a continent, country, university and program, then apply or ask for guidance." },
  { href: "/visa", icon: "passport", title: "Visa Processing", text: "Answer a few questions to see the official checklist for your trip, then apply or book a consultation." },
  { href: "/flights", icon: "plane", title: "Flight booking", text: "Tell us your route, dates and travellers; a consultant sends you options and prices." },
];

export default async function NewApplication() {
  await requireUser(["CLIENT"], "/portal/new");
  return (
    <div className="grid gap-5">
      <div><h1 className="text-[clamp(26px,3vw,36px)]">New application</h1><p className="mt-1 max-w-2xl muted">Pick a service. You&apos;ll choose the exact job, program or visa on the website, and the application comes back here with its reference number.</p></div>
      <div className="grid gap-4 sm:grid-cols-2">
        {CHOICES.map((c) => (
          <Link key={c.href} href={c.href} className="card-link flex gap-4 p-5">
            <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand"><Icon name={c.icon} className="size-6" /></span>
            <span><span className="block font-display text-lg font-bold">{c.title}</span><span className="mt-1 block text-sm muted">{c.text}</span></span>
          </Link>
        ))}
      </div>
    </div>
  );
}
