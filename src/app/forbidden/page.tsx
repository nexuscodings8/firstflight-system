import Link from "next/link";
export default function Forbidden() {
  return <div className="wrap max-w-xl py-20 text-center"><h1 className="text-3xl">You don&apos;t have access to this page</h1><p className="mt-3 muted">Your account&apos;s role doesn&apos;t include this area.</p><Link href="/" className="btn-primary mt-6">Go to the home page</Link></div>;
}
