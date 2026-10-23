import { headers } from "next/headers";
import { notFound } from "next/navigation";

import {
  isSyntheticDemoEnabled,
  isSyntheticDemoHostAllowed,
} from "@/ai-analysis/synthetic-demo/access";
import { SyntheticAIDemoScreen } from "@/components/local-demo/synthetic-ai-demo-screen";

export const dynamic = "force-dynamic";

export default async function LocalSyntheticAIDemoPage() {
  const requestHeaders = await headers();
  const env = process.env;
  if (!isSyntheticDemoEnabled(env) || !isSyntheticDemoHostAllowed(requestHeaders.get("host"), env)) {
    notFound();
  }

  return <SyntheticAIDemoScreen />;
}
