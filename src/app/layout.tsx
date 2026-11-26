import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { HelpDock } from "@/components/help-dock";
import { ChromeGate } from "@/components/shell/chrome-gate";
import { asc, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";

// Every page reads live data (listings, the signed-in user), so render on each request.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "FIRST FLIGHT | Work, study and visas abroad", template: "%s | FIRST FLIGHT" },
  description: "FIRST FLIGHT BEST TRAVEL SOLUTION LTD helps you find jobs abroad, study programs and visa requirements, then apply and track every step.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const contacts = await db.select({ id: s.whatsappContacts.id, name: s.whatsappContacts.name, department: s.whatsappContacts.department, number: s.whatsappContacts.number })
    .from(s.whatsappContacts).where(eq(s.whatsappContacts.active, true)).orderBy(asc(s.whatsappContacts.sortOrder)).catch(() => []);
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Exo+2:wght@600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="flex min-h-screen flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2">Skip to content</a>
        <ChromeGate><SiteHeader /></ChromeGate>
        <main id="main" className="flex-1">{children}</main>
        <ChromeGate><SiteFooter /></ChromeGate>
        <HelpDock contacts={contacts} />
      </body>
    </html>
  );
}
