import Link from "next/link";
export default function NotFound() {
  return <div className="wrap max-w-xl py-20 text-center"><h1 className="text-3xl">Page not found</h1><p className="mt-3 muted">It may have moved, closed or been unpublished.</p><div className="mt-6 flex justify-center gap-2"><Link href="/work" className="btn-ghost">Jobs</Link><Link href="/study" className="btn-ghost">Study</Link><Link href="/visa" className="btn-ghost">Visa</Link></div></div>;
}
