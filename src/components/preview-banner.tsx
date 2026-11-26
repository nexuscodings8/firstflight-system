import Link from "next/link";

export function PreviewBanner({ status, editHref }: { status: string; editHref: string }) {
  return (
    <div role="status" className="sticky top-[73px] z-30 border-b-2 border-gold bg-gold/90 text-ink">
      <div className="wrap flex flex-wrap items-center gap-3 py-2 text-sm font-semibold">
        <span>Preview: {status === "PUBLISHED" ? "this is live on the website." : status === "ARCHIVED" ? "archived, visitors can't see this page." : "draft, visitors can't see this page yet."}</span>
        <Link href={editHref} className="ml-auto underline">Back to editing</Link>
      </div>
    </div>
  );
}
