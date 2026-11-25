import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { COMPANY } from "@/lib/company";
import { PageHero } from "@/components/page-hero";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { EnquiryForm } from "@/components/enquiry-form";
import { Icon } from "@/components/icons";

export const metadata: Metadata = { title: "Contact" };
export default async function Contact() {
  const user = await getCurrentUser();
  return (
    <>
      <PageHero title="Speak to a consultant" intro="Call, email or send us a message. We reply to every enquiry." />
      <div className="wrap">
        <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Contact" }]} />
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="card p-6"><h2 className="text-xl">Send a message</h2><div className="mt-4"><EnquiryForm type="GENERAL" context={{ page: "contact" }} user={user} /></div></div>
          <div className="card space-y-4 p-6">
            <h2 className="text-xl">Call us</h2>
            {COMPANY.phones.map((p) => <a key={p} href={`tel:${p.replace(/\s/g, "")}`} className="flex items-center gap-3 font-semibold text-brand hover:underline"><Icon name="phone" />{p}</a>)}
            <h2 className="pt-2 text-xl">Email</h2>
            <a href={`mailto:${COMPANY.email}`} className="flex items-center gap-3 font-semibold text-brand hover:underline"><Icon name="mail" />{COMPANY.email}</a>
          </div>
        </div>
      </div>
    </>
  );
}
