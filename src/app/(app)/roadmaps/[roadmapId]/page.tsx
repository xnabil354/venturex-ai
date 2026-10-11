import { notFound } from "next/navigation";

import { getCurrentUser } from "@/auth/current-user";
import { USER_TYPES } from "@/auth/user-types";
import { RoadmapDetailView } from "@/components/roadmaps/roadmap-detail";
import { roadmapIdSchema } from "@/roadmap/domain";
import { StartupRoadmapService } from "@/roadmap/service";

export default async function RoadmapDetailPage({
  params,
}: {
  readonly params: Promise<{ readonly roadmapId: string }>;
}) {
  const [user, { roadmapId }] = await Promise.all([getCurrentUser(), params]);
  if (!user || user.userType !== USER_TYPES.ENTREPRENEUR || !roadmapIdSchema.safeParse(roadmapId).success) {
    notFound();
  }
  const roadmap = await new StartupRoadmapService({ currentUserResolver: async () => user }).getForCurrentUser(roadmapId);
  if (!roadmap) notFound();
  return <RoadmapDetailView roadmap={roadmap} />;
}
