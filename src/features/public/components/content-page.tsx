import type { ReactNode } from "react";

/** چیدمان صفحات محتوایی عمومی (عنوان + متن) با هویت بصری سایت */
export function ContentHero({ eyebrow, title, description }: { eyebrow?: string; title: string; description?: string }) {
  return (
    <section className="bg-luxe border-b border-border/60">
      <div className="container-page py-12 sm:py-16">
        {eyebrow && <p className="mb-3 text-xs font-semibold text-gold-600">{eyebrow}</p>}
        <h1 className="max-w-2xl text-3xl leading-[1.4] font-black sm:text-4xl">{title}</h1>
        {description && <p className="mt-4 max-w-2xl text-base leading-8 text-muted">{description}</p>}
      </div>
    </section>
  );
}

export function Prose({ children }: { children: ReactNode }) {
  return <div className="container-page max-w-3xl space-y-5 py-10 text-[0.95rem] leading-8 text-foreground/90 sm:py-14 [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-bold [&_li]:ms-5 [&_li]:list-disc [&_ul]:space-y-1.5">{children}</div>;
}
