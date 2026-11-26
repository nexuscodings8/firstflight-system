export const dynamic = "force-dynamic"; // built per request from the live database

import type { MetadataRoute } from "next";
import { listJobs, listNews, searchPrograms } from "@/lib/queries";
import { siteUrl } from "@/lib/email";

// Public pages for search engines: fixed pages plus every published job, program and news post.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const [jobs, programs, news] = await Promise.all([listJobs({}), searchPrograms({}), listNews()]);
  return [
    ...["", "/work", "/work/jobs", "/study", "/study/search", "/visa", "/flights", "/news", "/contact", "/enquire"].map((p) => ({ url: `${base}${p}` })),
    ...jobs.map((r) => ({ url: `${base}/work/${r.country.slug}/${r.job.slug}`, lastModified: r.job.updatedAt })),
    ...programs.map((r) => ({ url: `${base}/study/${r.continent.slug}/${r.country.slug}/${r.uni.slug}/${r.program.slug}`, lastModified: r.program.updatedAt })),
    ...news.map((n) => ({ url: `${base}/news/${n.slug}`, lastModified: n.publishedAt ?? undefined })),
  ];
}
