import {
  ONBOARDING_STATUSES,
  USER_TYPES,
  type SafeUser,
} from "./user-types";

const NON_APPLICATION_PATHS = ["/login", "/register", "/onboarding"] as const;

type RoutingUser = Pick<SafeUser, "onboardingStatus" | "userType">;

export function isSafeReturnPath(path: string | null | undefined): path is string {
  if (!path || !path.startsWith("/") || path.startsWith("//")) {
    return false;
  }

  return !NON_APPLICATION_PATHS.some(
    (blockedPath) => path === blockedPath || path.startsWith(`${blockedPath}/`),
  );
}

export function resolveOnboardingDestination(user: RoutingUser): string {
  if (user.onboardingStatus === ONBOARDING_STATUSES.COMPLETED) {
    return "/dashboard";
  }

  if (user.userType === null) {
    return "/onboarding";
  }

  return user.userType === USER_TYPES.ENTREPRENEUR
    ? "/onboarding/entrepreneur"
    : "/onboarding/business";
}

export function resolvePostLoginDestination(
  user: RoutingUser,
  requestedPath?: string | null,
): string {
  if (user.onboardingStatus !== ONBOARDING_STATUSES.COMPLETED) {
    return resolveOnboardingDestination(user);
  }

  return isSafeReturnPath(requestedPath) ? requestedPath : "/dashboard";
}
