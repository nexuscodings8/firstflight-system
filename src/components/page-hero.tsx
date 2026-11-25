export function PageHero({ title, intro, children }: { title: string; intro?: string; children?: React.ReactNode }) {
  return (
    <section className="bg-[linear-gradient(135deg,var(--color-brand),#2f72d8)] text-white">
      <div className="wrap py-10 sm:py-14">
        <h1 className="max-w-3xl text-3xl text-white sm:text-4xl lg:text-5xl">{title}</h1>
        {intro && <p className="mt-3 max-w-2xl text-lg text-white/90">{intro}</p>}
        {children}
      </div>
    </section>
  );
}
