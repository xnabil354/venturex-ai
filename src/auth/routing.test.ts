import { describe, expect, it } from "vitest";

import {
  isSafeReturnPath,
  resolveOnboardingDestination,
  resolvePostLoginDestination,
} from "./routing";
import { ONBOARDING_STATUSES, USER_TYPES } from "./user-types";

describe("post-login routing", () => {
  it("sends users without a type to user type selection", () => {
    expect(
      resolvePostLoginDestination({
        onboardingStatus: ONBOARDING_STATUSES.NOT_STARTED,
        userType: null,
      }),
    ).toBe("/onboarding");
  });

  it("sends entrepreneurs with incomplete profiles to entrepreneur setup", () => {
    expect(
      resolvePostLoginDestination({
        onboardingStatus: ONBOARDING_STATUSES.USER_TYPE_SELECTED,
        userType: USER_TYPES.ENTREPRENEUR,
      }),
    ).toBe("/onboarding/entrepreneur");
  });

  it("sends existing businesses with incomplete profiles to business setup", () => {
    expect(
      resolvePostLoginDestination({
        onboardingStatus: ONBOARDING_STATUSES.PROFILE_IN_PROGRESS,
        userType: USER_TYPES.UMKM_EXISTING,
      }),
    ).toBe("/onboarding/business");
  });

  it("sends completed users to a safe requested application path", () => {
    expect(
      resolvePostLoginDestination(
        {
          onboardingStatus: ONBOARDING_STATUSES.COMPLETED,
          userType: USER_TYPES.ENTREPRENEUR,
        },
        "/trends",
      ),
    ).toBe("/trends");
  });

  it("sends completed users to the dashboard without a requested path", () => {
    expect(
      resolvePostLoginDestination({
        onboardingStatus: ONBOARDING_STATUSES.COMPLETED,
        userType: USER_TYPES.UMKM_EXISTING,
      }),
    ).toBe("/dashboard");
  });

  it("corrects a mismatched onboarding route", () => {
    expect(
      resolveOnboardingDestination({
        onboardingStatus: ONBOARDING_STATUSES.USER_TYPE_SELECTED,
        userType: USER_TYPES.ENTREPRENEUR,
      }),
    ).toBe("/onboarding/entrepreneur");
    expect(
      resolveOnboardingDestination({
        onboardingStatus: ONBOARDING_STATUSES.USER_TYPE_SELECTED,
        userType: USER_TYPES.UMKM_EXISTING,
      }),
    ).toBe("/onboarding/business");
  });

  it("rejects external and auth-only return paths", () => {
    expect(isSafeReturnPath("//example.com")).toBe(false);
    expect(isSafeReturnPath("/login")).toBe(false);
    expect(
      resolvePostLoginDestination(
        {
          onboardingStatus: ONBOARDING_STATUSES.COMPLETED,
          userType: USER_TYPES.ENTREPRENEUR,
        },
        "/register",
      ),
    ).toBe("/dashboard");
  });
});
