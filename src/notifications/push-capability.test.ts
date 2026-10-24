import { describe, expect, it } from "vitest";
import { pushCapability } from "./push-capability";
const supported = { secure: true, serviceWorker: true, pushManager: true, notification: true, ios: false, standalone: false };
describe("push progressive enhancement", () => {
  it("explains iOS Home Screen installation without claiming browser support", () => {
    expect(pushCapability({ ...supported, ios: true }).hint).toContain("Layar Utama");
    expect(pushCapability({ ...supported, ios: true }).supported).toBe(false);
    expect(pushCapability({ ...supported, ios: true, standalone: true }).supported).toBe(true);
  });
  it("requires real capabilities even in an installed iOS app", () => {
    expect(pushCapability({ ...supported, ios: true, standalone: true, pushManager: false }).supported).toBe(false);
    expect(pushCapability({ ...supported, secure: false }).hint).toContain("HTTPS");
    expect(pushCapability({ ...supported, notification: false }).hint).toContain("arsip notifikasi");
  });
});
