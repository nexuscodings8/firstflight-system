import { notFound } from "next/navigation";
import { getNews } from "@/lib/queries";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { date } from "@/lib/format";
export default async function Post({ params }: { params: Promise<{ slug: string }> }) {
  const n = await getNews((await params).slug);
  if (!n) notFound();
  return (<div className="wrap max-w-3xl"><Breadcrumbs items={[{ href: "/", label: "Home" }, { href: "/news", label: "News" }, { label: n.title }]} />
    <article className="card p-6 sm:p-10"><p className="text-sm muted">{date(n.publishedAt)}</p><h1 className="mt-2 text-3xl">{n.title}</h1><p className="mt-5 whitespace-pre-line text-lg leading-relaxed">{n.body}</p></article></div>);
}
