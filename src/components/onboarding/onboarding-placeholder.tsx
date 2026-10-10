type OnboardingPlaceholderProps = {
  message: string;
  title: string;
};

export function OnboardingPlaceholder({
  message,
  title,
}: OnboardingPlaceholderProps) {
  return (
    <section className="border border-soft-mist bg-paper-white p-20 sm:p-24">
      <p className="text-caption font-w540 uppercase tracking-[0.08em] text-stone-gray">
        Tahap berikutnya
      </p>
      <h1 className="mt-12 text-heading-sm font-w460 leading-heading-sm tracking-heading-sm text-ink-charcoal">
        {title}
      </h1>
      <p className="mt-12 max-w-[48ch] text-body-sm leading-body-sm text-stone-gray">
        {message}
      </p>
    </section>
  );
}
