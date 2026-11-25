import Link from "next/link";
export default async function Thanks({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const { ref } = await searchParams;
  return <div className="wrap max-w-xl py-16 text-center"><h1 className="text-3xl">Thank you, we&apos;ve got your message</h1>{ref && <p className="mt-3">Your reference is <strong>{ref}</strong>.</p>}<p className="mt-2 muted">A consultant will contact you soon.</p><Link href="/" className="btn-primary mt-6">Back to the home page</Link></div>;
}
