import Link from "next/link";
import { listNews } from "@/lib/queries";
import { PageHero } from "@/components/page-hero";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Empty } from "@/components/cards";
import { date } from "@/lib/format";
export const metadata = { title: "News and updates" };
export default async function News() {
  const posts = await listNews();
  return (<><PageHero title="News and updates" /><div className="wrap"><Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "News" }]} />
    <div className="grid gap-4 md:grid-cols-3">{posts.map((n) => <Link key={n.id} href={`/news/${n.slug}`} className="card-link p-5"><p className="text-sm muted">{date(n.publishedAt)}</p><h2 className="mt-1 text-lg">{n.title}</h2><p className="mt-2 text-sm muted">{n.excerpt}</p></Link>)}</div>
    {!posts.length && <Empty title="No news yet" />}</div></>);
}
