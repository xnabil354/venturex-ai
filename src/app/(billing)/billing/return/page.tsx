import { redirect } from "next/navigation";

// Existing Duitku invoices can still return here after newer invoices use /billing directly.
export default function BillingReturnPage(): never {
  redirect("/billing?payment=verifying");
}
