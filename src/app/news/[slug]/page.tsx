import { notFound } from "next/navigation";
import { getNews } from "@/lib/queries";
import { previewMode } from "@/lib/preview";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { PreviewBanner } from "@/components/preview-banner";
import { date } from "@/lib/format";

export default async function Post({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const preview = await previewMode(await searchParams);
  const n = await getNews((await params).slug, preview);
  if (!n) notFound();
  return (
    <>
      {preview && <PreviewBanner status={n.status} editHref={`/staff/content/news/${n.id}`} />}
      <div className="wrap max-w-3xl"><Breadcrumbs items={[{ href: "/", label: "Home" }, { href: "/news", label: "News" }, { label: n.title }]} />
        <article className="card p-6 sm:p-10"><p className="text-sm muted">{n.publishedAt ? date(n.publishedAt) : "Not published yet"}</p><h1 className="mt-2 text-3xl">{n.title}</h1><p className="mt-5 whitespace-pre-line text-lg leading-relaxed">{n.body}</p></article></div>
    </>
  );
}
