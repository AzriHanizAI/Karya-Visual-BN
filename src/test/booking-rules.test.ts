import { describe, expect, it } from "vitest";
import { BOOKING_STATUSES, calculateEstimate, STUDIO_CONFIG } from "@/lib/studio";

describe("Booking rules", () => {
  it("accepts exactly the four requested appointment statuses", () => {
    expect(BOOKING_STATUSES).toEqual(["pending", "confirmed", "completed", "cancelled"]);
  });
  it("preserves the supplied commercial estimate", () => {
    expect(
      calculateEstimate("commercial-video", "Half-Day Shoot (Up to 4 hrs)", 1, false, []),
    ).toEqual({ min: 720, max: 980 });
  });
  it("preserves the supplied full-day, location, travel, and drone prices", () => {
    expect(
      calculateEstimate("product-photo", "Full-Day Shoot (Up to 8 hrs)", 2, true, [
        "4K Drone Aerial Coverage",
      ]),
    ).toEqual({ min: 1080, max: 1460 });
  });
  it("limits locations to the supplied 1–10 range", () => {
    expect(() =>
      calculateEstimate("product-photo", "Half-Day Shoot (Up to 4 hrs)", 0, false, []),
    ).toThrow();
    expect(() =>
      calculateEstimate("product-photo", "Half-Day Shoot (Up to 4 hrs)", 11, false, []),
    ).toThrow();
  });
  it("keeps Sundays closed", () => {
    expect(STUDIO_CONFIG.disabledWeekdays).toEqual([0]);
  });
});
