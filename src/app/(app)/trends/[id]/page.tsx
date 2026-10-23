import { notFound } from "next/navigation";

/** Historical catalog records remain stored for audit, but are not user-facing data. */
export default async function TrendDetailPage(_props: {
  readonly params: Promise<{ readonly id: string }>;
}): Promise<never> {
  notFound();
}