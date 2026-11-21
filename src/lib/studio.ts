import { Clapperboard, Video, Camera, Aperture, Plane, Zap, HardDrive, Mic } from "lucide-react";
export const STUDIO_CONFIG = {
  studioName: "Studio",
  currencyPrefix: "B$",
  estimateSpread: 0.15,
  defaultMerchantWhatsapp: "6738000000",
  timezoneLabel: "Brunei Time (GMT+8)",
  timezoneOffsetHours: 8,
  services: [
    {
      id: "commercial-video",
      name: "Commercial & Brand Video",
      description: "Brand films, TV spots and corporate storytelling.",
      basePrice: 850,
      icon: Clapperboard,
    },
    {
      id: "event-wedding",
      name: "Event & Wedding Coverage",
      description: "Weddings, launches, conferences and celebrations.",
      basePrice: 650,
      icon: Video,
    },
    {
      id: "product-photo",
      name: "Product & Studio Photography",
      description: "E-commerce, menu and lookbook photography.",
      basePrice: 350,
      icon: Camera,
    },
    {
      id: "social-reels",
      name: "Monthly Social Reels Package",
      description: "Short-form vertical content for Reels & TikTok.",
      basePrice: 500,
      icon: Aperture,
    },
  ],
  durations: [
    { id: "half-day", label: "Half-Day Shoot", detail: "Up to 4 hrs", price: 0 },
    { id: "full-day", label: "Full-Day Shoot", detail: "Up to 8 hrs", price: 400 },
    { id: "multi-day", label: "Multi-Day Production", detail: "2+ days", price: 950 },
  ],
  locations: { min: 1, max: 10, includedCount: 1, pricePerExtra: 150 },
  outsideDistrict: {
    label: "Travel outside Brunei-Muara District",
    detail: "Tutong / Kuala Belait / Temburong",
    price: 120,
  },
  addons: [
    { id: "drone", label: "4K Drone Aerial Coverage", price: 250, icon: Plane },
    { id: "same-day", label: "Same-Day Highlight Cut", price: 300, icon: Zap },
    { id: "raw-drive", label: "Raw Footage Hard Drive Handoff", price: 150, icon: HardDrive },
    { id: "script-vo", label: "Scriptwriting & Voiceover", price: 200, icon: Mic },
  ],
  timeSlots: [
    { value: "10:00", label: "10:00 AM" },
    { value: "11:30", label: "11:30 AM" },
    { value: "14:00", label: "02:00 PM" },
    { value: "15:30", label: "03:30 PM" },
    { value: "17:00", label: "05:00 PM" },
    { value: "20:00", label: "08:00 PM", note: "After-Hours" },
  ],
  disabledWeekdays: [0] as number[],
  steps: ["Service", "Scope", "Schedule", "Details"],
} as const;

export function calculateEstimate(
  serviceId: string,
  durationLabel: string,
  locations: number,
  outside: boolean,
  addons: string[],
) {
  const service = STUDIO_CONFIG.services.find((s) => s.id === serviceId);
  const duration = STUDIO_CONFIG.durations.find(
    (d) => `${d.label} (${d.detail})` === durationLabel,
  );
  if (!service || !duration) throw new Error("Invalid production selection.");
  if (!Number.isInteger(locations) || locations < 1 || locations > 10)
    throw new Error("Choose 1–10 locations.");
  if (
    new Set(addons).size !== addons.length ||
    addons.some((label) => !STUDIO_CONFIG.addons.some((a) => a.label === label))
  )
    throw new Error("Invalid add-ons.");
  const total =
    service.basePrice +
    duration.price +
    (locations - 1) * STUDIO_CONFIG.locations.pricePerExtra +
    (outside ? STUDIO_CONFIG.outsideDistrict.price : 0) +
    STUDIO_CONFIG.addons
      .filter((a) => addons.includes(a.label))
      .reduce((sum, a) => sum + a.price, 0);
  return { min: Math.round((total * 0.85) / 10) * 10, max: Math.round((total * 1.15) / 10) * 10 };
}
export const BOOKING_STATUSES = ["pending", "confirmed", "completed", "cancelled"] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];
