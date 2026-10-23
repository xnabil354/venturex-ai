import { notFound } from "next/navigation";

/** Global historical Opportunities are archived and are not user-facing hypotheses. */
export default async function OpportunityDetailPage(_props: {
  readonly params: Promise<{ readonly id: string }>;
}): Promise<never> {
  notFound();
}