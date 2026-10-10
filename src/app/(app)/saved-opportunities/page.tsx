import { SavedOpportunitiesList } from "@/components/opportunities/saved-opportunities-list";
import { SavedOpportunityService } from "@/opportunity/saved-service";

export default async function SavedOpportunitiesPage() {
  const result = await new SavedOpportunityService().listForCurrentUser();
  return <SavedOpportunitiesList result={result} />;
}
