import { getCurrentUser } from "@/auth/current-user";
import { isUserType } from "@/auth/user-types";
import { TrendList } from "@/components/trends/trend-list";
import { projectTrendList } from "@/trend/list-projection";
import { TrendService } from "@/trend/service";

export class TrendListAccessContextError extends Error {
  override readonly name = "TrendListAccessContextError";

  constructor() {
    super("The persisted Trend List access context is invalid.");
  }
}

export default async function TrendsPage() {
  const user = await getCurrentUser();
  if (!user || !isUserType(user.userType)) {
    throw new TrendListAccessContextError();
  }

  const trends = await new TrendService(undefined, async () => user).getPublishedTrends();
  const items = projectTrendList(trends, user.userType);

  return <TrendList items={items} />;
}
