import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Aperture,
  CalendarCheck,
  CalendarDays,
  Camera,
  Check,
  ChevronUp,
  Clapperboard,
  Clock,
  Copy,
  FileText,
  HardDrive,
  Loader2,
  MapPin,
  MessageCircle,
  Minus,
  Mic,
  Plane,
  Plus,
  Receipt,
  ShieldCheck,
  Sparkles,
  Video,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/* ------------------------------------------------------------------ */
/*  STUDIO_CONFIG — edit this block to customise services & pricing   */
/* ------------------------------------------------------------------ */

export { STUDIO_CONFIG } from "@/lib/studio";
import { STUDIO_CONFIG } from "@/lib/studio";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface BookingSubmission {
  referenceId: string;
  serviceId: string;
  serviceName: string;
  durationLabel: string;
  locationCount: number;
  outsideBruneiMuara: boolean;
  selectedAddons: string[];
  estimatedMinBnd: number;
  estimatedMaxBnd: number;
  bookingDate: string; // YYYY-MM-DD
  bookingTime: string;
  clientName: string;
  companyName: string;
  whatsappNumber: string;
  email: string;
  projectBrief: string;
}

export interface ServiceEstimatorPortalProps {
  bookedSlots?: Array<{ date: string; time: string }>;
  onSubmitBooking?: (data: BookingSubmission) => Promise<void> | void;
  merchantWhatsapp?: string;
}

type LineItem = { label: string; amount: number };
type FormFields = {
  clientName: string;
  companyName: string;
  whatsappNumber: string;
  email: string;
  projectBrief: string;
};
type FormErrors = Partial<Record<keyof FormFields, string | undefined>>;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const formatBnd = (amount: number) =>
  `${STUDIO_CONFIG.currencyPrefix} ${amount.toLocaleString("en-US")}`;

const toIsoDate = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const formatLongDate = (date: Date) =>
  date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

const getStudioNow = () => {
  const shifted = new Date(Date.now() + STUDIO_CONFIG.timezoneOffsetHours * 3_600_000);
  return {
    today: new Date(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()),
    minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  };
};

const slotToMinutes = (value: string) => {
  const [h = 0, m = 0] = value.split(":").map(Number);
  return h * 60 + m;
};

const normaliseTime = (time: string) => time.trim().toUpperCase().replace(/^0/, "");

const generateReference = () => `BRN-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validateField(field: keyof FormFields, value: string): string | undefined {
  const trimmed = value.trim();
  switch (field) {
    case "clientName":
      return trimmed.length < 2 ? "Please enter your full name." : undefined;
    case "whatsappNumber": {
      const digits = trimmed.replace(/\D/g, "");
      return digits.length !== 7 ? "Enter a valid 7-digit Brunei number." : undefined;
    }
    case "email":
      return EMAIL_PATTERN.test(trimmed) ? undefined : "Enter a valid email address.";
    default:
      return undefined;
  }
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  }
}

/* ------------------------------------------------------------------ */
/*  Root component                                                     */
/* ------------------------------------------------------------------ */

export function ServiceEstimatorPortal({
  bookedSlots = [],
  onSubmitBooking,
  merchantWhatsapp = STUDIO_CONFIG.defaultMerchantWhatsapp,
}: ServiceEstimatorPortalProps) {
  const [step, setStep] = useState(0);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [durationId, setDurationId] = useState<string>(STUDIO_CONFIG.durations[0].id);
  const [locationCount, setLocationCount] = useState<number>(STUDIO_CONFIG.locations.min);
  const [outsideBruneiMuara, setOutsideBruneiMuara] = useState(false);
  const [addonIds, setAddonIds] = useState<string[]>([]);
  const [bookingDate, setBookingDate] = useState<Date | undefined>();
  const [bookingTime, setBookingTime] = useState<string | null>(null);
  const [form, setForm] = useState<FormFields>({
    clientName: "",
    companyName: "",
    whatsappNumber: "",
    email: "",
    projectBrief: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<BookingSubmission | null>(null);
  const [mobileSummaryOpen, setMobileSummaryOpen] = useState(false);

  const service = STUDIO_CONFIG.services.find((s) => s.id === serviceId) ?? null;
  const duration =
    STUDIO_CONFIG.durations.find((d) => d.id === durationId) ?? STUDIO_CONFIG.durations[0];
  const timeSlot = STUDIO_CONFIG.timeSlots.find((t) => t.value === bookingTime) ?? null;

  const estimate = useMemo(() => {
    const items: LineItem[] = [];
    if (!service) return { items, subtotal: 0, min: 0, max: 0 };

    items.push({ label: service.name, amount: service.basePrice });
    items.push({ label: `${duration.label} (${duration.detail})`, amount: duration.price });

    const extraLocations = Math.max(0, locationCount - STUDIO_CONFIG.locations.includedCount);
    if (extraLocations > 0) {
      items.push({
        label: `${extraLocations} additional location${extraLocations > 1 ? "s" : ""}`,
        amount: extraLocations * STUDIO_CONFIG.locations.pricePerExtra,
      });
    }
    if (outsideBruneiMuara) {
      items.push({ label: "Out-of-district travel", amount: STUDIO_CONFIG.outsideDistrict.price });
    }
    STUDIO_CONFIG.addons
      .filter((a) => addonIds.includes(a.id))
      .forEach((a) => items.push({ label: a.label, amount: a.price }));

    const subtotal = items.reduce((sum, i) => sum + i.amount, 0);
    const spread = STUDIO_CONFIG.estimateSpread;
    return {
      items,
      subtotal,
      min: Math.round((subtotal * (1 - spread)) / 10) * 10,
      max: Math.round((subtotal * (1 + spread)) / 10) * 10,
    };
  }, [service, duration, locationCount, outsideBruneiMuara, addonIds]);

  const scheduleLabel =
    bookingDate && timeSlot ? `${formatLongDate(bookingDate)} · ${timeSlot.label}` : null;

  const canProceed = [Boolean(service), true, Boolean(bookingDate && bookingTime), true][step];

  const goToStep = (target: number) => {
    setStep(target);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const updateField = (field: keyof FormFields, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: validateField(field, value) }));
  };

  const handleBlur = (field: keyof FormFields) =>
    setErrors((prev) => ({ ...prev, [field]: validateField(field, form[field]) }));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!service || !bookingDate || !timeSlot) return;

    const nextErrors: FormErrors = {};
    (Object.keys(form) as Array<keyof FormFields>).forEach((field) => {
      const error = validateField(field, form[field]);
      if (error) nextErrors[field] = error;
    });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const submission: BookingSubmission = {
      referenceId: generateReference(),
      serviceId: service.id,
      serviceName: service.name,
      durationLabel: `${duration.label} (${duration.detail})`,
      locationCount,
      outsideBruneiMuara,
      selectedAddons: STUDIO_CONFIG.addons
        .filter((a) => addonIds.includes(a.id))
        .map((a) => a.label),
      estimatedMinBnd: estimate.min,
      estimatedMaxBnd: estimate.max,
      bookingDate: toIsoDate(bookingDate),
      bookingTime: timeSlot.label,
      clientName: form.clientName.trim(),
      companyName: form.companyName.trim(),
      whatsappNumber: `+673${form.whatsappNumber.replace(/\D/g, "")}`,
      email: form.email.trim(),
      projectBrief: form.projectBrief.trim(),
    };

    setSubmitError(null);
    setIsSubmitting(true);
    try {
      if (!onSubmitBooking) throw new Error("Booking submission is not connected yet.");
      await onSubmitBooking(submission);
      setConfirmed(submission);
      setMobileSummaryOpen(false);
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Something went wrong. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetPortal = () => {
    setConfirmed(null);
    setStep(0);
    setServiceId(null);
    setDurationId(STUDIO_CONFIG.durations[0].id);
    setLocationCount(STUDIO_CONFIG.locations.min);
    setOutsideBruneiMuara(false);
    setAddonIds([]);
    setBookingDate(undefined);
    setBookingTime(null);
    setForm({ clientName: "", companyName: "", whatsappNumber: "", email: "", projectBrief: "" });
    setErrors({});
  };

  if (confirmed) {
    return (
      <div className="min-h-screen bg-muted/50 px-4 py-10 sm:py-16">
        <ConfirmationCard
          booking={confirmed}
          items={estimate.items}
          merchantWhatsapp={merchantWhatsapp}
          onReset={resetPortal}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/50 text-primary">
      <div className="mx-auto max-w-6xl px-4 pb-32 pt-8 sm:px-6 sm:pt-12 lg:pb-16">
        <header className="mb-8 flex flex-col gap-2">
          <Badge
            variant="outline"
            className="w-fit gap-1.5 border-border/80 bg-card text-muted-foreground"
          >
            <Sparkles className="size-3" aria-hidden="true" />
            Instant BND quote
          </Badge>
          <h1 className="text-balance text-2xl font-semibold tracking-normal text-foreground sm:text-3xl">
            Plan your production & book a consultation
          </h1>
          <p className="max-w-xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
            Configure your shoot, see a live Brunei Dollar estimate, and lock in a time to talk it
            through with our team.
          </p>
        </header>

        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <main className="flex min-w-0 flex-col gap-6 lg:w-[65%]">
            <StepIndicator current={step} canJumpTo={(i) => i < step} onJump={goToStep} />

            <Card className="gap-0 overflow-hidden border-border/80 bg-card p-0 shadow-sm ring-0">
              <div
                key={step}
                className="animate-in fade-in slide-in-from-right-4 p-5 duration-300 sm:p-8"
              >
                {step === 0 && (
                  <ServiceStep selectedId={serviceId} onSelect={(id) => setServiceId(id)} />
                )}
                {step === 1 && (
                  <ScopeStep
                    durationId={durationId}
                    onDurationChange={setDurationId}
                    locationCount={locationCount}
                    onLocationChange={setLocationCount}
                    outsideBruneiMuara={outsideBruneiMuara}
                    onOutsideChange={setOutsideBruneiMuara}
                    addonIds={addonIds}
                    onToggleAddon={(id) =>
                      setAddonIds((prev) =>
                        prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id],
                      )
                    }
                  />
                )}
                {step === 2 && (
                  <ScheduleStep
                    date={bookingDate}
                    time={bookingTime}
                    bookedSlots={bookedSlots}
                    onDateChange={(d) => {
                      setBookingDate(d);
                      setBookingTime(null);
                    }}
                    onTimeChange={setBookingTime}
                  />
                )}
                {step === 3 && (
                  <DetailsStep
                    form={form}
                    errors={errors}
                    onChange={updateField}
                    onBlur={handleBlur}
                    onSubmit={handleSubmit}
                    isSubmitting={isSubmitting}
                    submitError={submitError}
                    serviceName={service?.name ?? ""}
                    scheduleLabel={scheduleLabel ?? ""}
                    estimateLabel={`${formatBnd(estimate.min)} – ${formatBnd(estimate.max)}`}
                  />
                )}
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-border/80 bg-muted/60 px-5 py-4 sm:px-8">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => goToStep(step - 1)}
                  disabled={step === 0 || isSubmitting}
                  className="text-muted-foreground"
                >
                  <ArrowLeft className="size-4" aria-hidden="true" />
                  Back
                </Button>
                <span className="text-xs text-muted-foreground">
                  Step {step + 1} of {STUDIO_CONFIG.steps.length}
                </span>
                {step < 3 ? (
                  <Button type="button" onClick={() => goToStep(step + 1)} disabled={!canProceed}>
                    Continue
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Button>
                ) : (
                  <span className="w-[88px]" aria-hidden="true" />
                )}
              </div>
            </Card>
          </main>

          <aside className="hidden lg:sticky lg:top-8 lg:block lg:w-[35%]">
            <Card className="gap-0 border-border/80 bg-card p-0 shadow-sm ring-0">
              <EstimateSummary
                items={estimate.items}
                min={estimate.min}
                max={estimate.max}
                scheduleLabel={scheduleLabel}
              />
            </Card>
          </aside>
        </div>
      </div>

      <MobileEstimateBar
        open={mobileSummaryOpen}
        onOpenChange={setMobileSummaryOpen}
        items={estimate.items}
        min={estimate.min}
        max={estimate.max}
        scheduleLabel={scheduleLabel}
      />
    </div>
  );
}

export default ServiceEstimatorPortal;

/* ------------------------------------------------------------------ */
/*  Step indicator                                                     */
/* ------------------------------------------------------------------ */

function StepIndicator({
  current,
  canJumpTo,
  onJump,
}: {
  current: number;
  canJumpTo: (index: number) => boolean;
  onJump: (index: number) => void;
}) {
  return (
    <nav aria-label="Booking progress">
      <ol className="grid grid-cols-4 gap-1.5 rounded-lg border border-border/80 bg-card p-1.5 shadow-sm">
        {STUDIO_CONFIG.steps.map((label, index) => {
          const isActive = index === current;
          const isDone = index < current;
          const clickable = canJumpTo(index);
          return (
            <li key={label}>
              <Button
                variant="portal"
                size="portal"
                type="button"
                onClick={() => clickable && onJump(index)}
                disabled={!clickable && !isActive}
                aria-current={isActive ? "step" : undefined}
                className={[
                  "flex w-full items-center justify-center gap-2 rounded-lg px-2 py-2 text-xs font-medium transition-colors sm:text-sm",
                  isActive && "bg-primary text-primary-foreground shadow-sm",
                  isDone && "text-foreground hover:bg-secondary",
                  !isActive && !isDone && "text-muted-foreground",
                  clickable ? "cursor-pointer" : "cursor-default",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <span
                  className={[
                    "flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                    isActive && "bg-card/15 text-primary-foreground",
                    isDone && "bg-primary text-primary-foreground",
                    !isActive && !isDone && "bg-secondary text-muted-foreground",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  aria-hidden="true"
                >
                  {isDone ? <Check className="size-3" /> : index + 1}
                </span>
                <span className="hidden sm:inline">{label}</span>
                <span className="sr-only sm:hidden">{label}</span>
              </Button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function StepHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-6 flex flex-col gap-1">
      <h2 className="text-lg font-semibold tracking-normal text-foreground">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Step 1 — Service                                                   */
/* ------------------------------------------------------------------ */

function ServiceStep({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <section>
      <StepHeading
        title="What are we creating?"
        description="Choose the service that best fits your project."
      />
      <div role="radiogroup" aria-label="Service category" className="grid gap-3 sm:grid-cols-2">
        {STUDIO_CONFIG.services.map((service) => {
          const selected = service.id === selectedId;
          const Icon: LucideIcon = service.icon;
          return (
            <Button
              variant="portal"
              size="portal"
              key={service.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onSelect(service.id)}
              className={[
                "group relative flex flex-col items-start gap-4 rounded-lg border bg-card p-5 text-left transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                selected
                  ? "border-primary shadow-sm ring-1 ring-primary"
                  : "border-border/80 hover:border-input hover:shadow-sm",
              ].join(" ")}
            >
              {selected && (
                <span className="absolute right-4 top-4 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="size-3" aria-hidden="true" />
                </span>
              )}
              <span
                className={[
                  "flex size-10 items-center justify-center rounded-lg border transition-colors",
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border/80 bg-muted text-foreground",
                ].join(" ")}
              >
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="flex flex-col gap-1">
                <span className="font-medium text-foreground">{service.name}</span>
                <span className="text-sm leading-relaxed text-muted-foreground">
                  {service.description}
                </span>
              </span>
              <Badge variant="secondary" className="bg-secondary font-medium text-foreground">
                From {formatBnd(service.basePrice)}
              </Badge>
            </Button>
          );
        })}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Step 2 — Scope                                                     */
/* ------------------------------------------------------------------ */

function ScopeStep({
  durationId,
  onDurationChange,
  locationCount,
  onLocationChange,
  outsideBruneiMuara,
  onOutsideChange,
  addonIds,
  onToggleAddon,
}: {
  durationId: string;
  onDurationChange: (id: string) => void;
  locationCount: number;
  onLocationChange: (count: number) => void;
  outsideBruneiMuara: boolean;
  onOutsideChange: (value: boolean) => void;
  addonIds: string[];
  onToggleAddon: (id: string) => void;
}) {
  const { min, max, includedCount, pricePerExtra } = STUDIO_CONFIG.locations;

  return (
    <section className="flex flex-col gap-8">
      <StepHeading
        title="Configure your scope"
        description="Your estimate updates instantly as you adjust each option."
      />

      <fieldset className="-mt-4 flex flex-col gap-3">
        <legend className="mb-3 text-sm font-medium text-primary">Production scale</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {STUDIO_CONFIG.durations.map((d) => {
            const selected = d.id === durationId;
            return (
              <label
                key={d.id}
                className={[
                  "relative flex cursor-pointer flex-col gap-1 rounded-lg border bg-card p-4 transition-all has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary has-[:focus-visible]:ring-offset-2",
                  selected
                    ? "border-primary ring-1 ring-primary"
                    : "border-border/80 hover:border-input",
                ].join(" ")}
              >
                <input
                  type="radio"
                  name="duration"
                  value={d.id}
                  checked={selected}
                  onChange={() => onDurationChange(d.id)}
                  className="sr-only"
                />
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-foreground">{d.label}</span>
                  <span
                    className={[
                      "flex size-4 items-center justify-center rounded-full border",
                      selected ? "border-primary bg-primary" : "border-input",
                    ].join(" ")}
                    aria-hidden="true"
                  >
                    {selected && <span className="size-1.5 rounded-full bg-card" />}
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">{d.detail}</span>
                <span className="mt-2 text-sm font-medium text-foreground">
                  {d.price === 0 ? "Included" : `+ ${formatBnd(d.price)}`}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="flex flex-col gap-3">
        <span className="text-sm font-medium text-primary" id="locations-label">
          Shoot locations
        </span>
        <div className="flex flex-col gap-4 rounded-lg border border-border/80 bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-muted text-foreground">
              <MapPin className="size-4" aria-hidden="true" />
            </span>
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-foreground">Number of locations</span>
              <span className="text-xs text-muted-foreground">
                First location included · + {formatBnd(pricePerExtra)} each additional
              </span>
            </div>
          </div>
          <div
            className="flex items-center gap-1 self-start rounded-lg border border-border/80 p-1 sm:self-auto"
            role="group"
            aria-labelledby="locations-label"
          >
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => onLocationChange(Math.max(min, locationCount - 1))}
              disabled={locationCount <= min}
              aria-label="Remove a location"
            >
              <Minus className="size-4" aria-hidden="true" />
            </Button>
            <output
              className="w-10 text-center text-sm font-semibold tabular-nums text-foreground"
              aria-live="polite"
            >
              {locationCount}
            </output>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => onLocationChange(Math.min(max, locationCount + 1))}
              disabled={locationCount >= max}
              aria-label="Add a location"
            >
              <Plus className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-lg border border-border/80 bg-card p-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-foreground" id="outside-label">
              {STUDIO_CONFIG.outsideDistrict.label}
            </span>
            <span className="text-xs text-muted-foreground">
              {STUDIO_CONFIG.outsideDistrict.detail} · +{" "}
              {formatBnd(STUDIO_CONFIG.outsideDistrict.price)}
            </span>
          </div>
          <Button
            variant="portal"
            size="portal"
            type="button"
            role="switch"
            aria-checked={outsideBruneiMuara}
            aria-labelledby="outside-label"
            onClick={() => onOutsideChange(!outsideBruneiMuara)}
            className={[
              "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
              outsideBruneiMuara ? "bg-primary" : "bg-border",
            ].join(" ")}
          >
            <span
              className={[
                "inline-block size-5 rounded-full bg-card shadow-sm transition-transform",
                outsideBruneiMuara ? "translate-x-[22px]" : "translate-x-0.5",
              ].join(" ")}
            />
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <span className="text-sm font-medium text-primary">
          Optional add-ons <span className="font-normal text-muted-foreground">· select any</span>
        </span>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {STUDIO_CONFIG.addons.map((addon) => {
            const active = addonIds.includes(addon.id);
            const Icon: LucideIcon = addon.icon;
            return (
              <Button
                variant="portal"
                size="portal"
                key={addon.id}
                type="button"
                aria-pressed={active}
                onClick={() => onToggleAddon(addon.id)}
                className={[
                  "flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border/80 bg-card text-primary hover:border-input",
                ].join(" ")}
              >
                <Icon
                  className={[
                    "size-4 shrink-0",
                    active ? "text-primary-foreground" : "text-muted-foreground",
                  ].join(" ")}
                  aria-hidden="true"
                />
                <span className="flex-1 text-sm font-medium">{addon.label}</span>
                <span
                  className={[
                    "text-xs font-medium tabular-nums",
                    active ? "text-primary-foreground/80" : "text-muted-foreground",
                  ].join(" ")}
                >
                  + {formatBnd(addon.price)}
                </span>
                <span
                  className={[
                    "flex size-4 shrink-0 items-center justify-center rounded border",
                    active ? "border-card bg-card text-primary" : "border-input",
                  ].join(" ")}
                  aria-hidden="true"
                >
                  {active && <Check className="size-3" />}
                </span>
              </Button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Step 3 — Schedule                                                  */
/* ------------------------------------------------------------------ */

function ScheduleStep({
  date,
  time,
  bookedSlots,
  onDateChange,
  onTimeChange,
}: {
  date: Date | undefined;
  time: string | null;
  bookedSlots: Array<{ date: string; time: string }>;
  onDateChange: (date: Date | undefined) => void;
  onTimeChange: (time: string) => void;
}) {
  const { today, minutes: nowMinutes } = getStudioNow();
  const isoDate = date ? toIsoDate(date) : null;
  const isToday = isoDate === toIsoDate(today);

  const bookedForDate = useMemo(() => {
    if (!isoDate) return new Set<string>();
    return new Set(bookedSlots.filter((s) => s.date === isoDate).map((s) => normaliseTime(s.time)));
  }, [bookedSlots, isoDate]);

  return (
    <section>
      <StepHeading
        title="Pick a consultation slot"
        description={`All times shown in ${STUDIO_CONFIG.timezoneLabel}. Closed on Sundays.`}
      />
      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        <div className="flex justify-center rounded-lg border border-border/80 bg-card p-2 md:shrink-0">
          <Calendar
            className="pointer-events-auto"
            mode="single"
            selected={date}
            onSelect={onDateChange}
            disabled={[{ before: today }, { dayOfWeek: STUDIO_CONFIG.disabledWeekdays }]}
            defaultMonth={date ?? today}
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <Clock className="size-4 text-muted-foreground" aria-hidden="true" />
            {date ? formatLongDate(date) : "Select a date first"}
          </div>
          {date ? (
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Available times">
              {STUDIO_CONFIG.timeSlots.map((slot) => {
                const isBooked =
                  bookedForDate.has(normaliseTime(slot.label)) ||
                  bookedForDate.has(normaliseTime(slot.value));
                const isPast = isToday && slotToMinutes(slot.value) <= nowMinutes;
                const unavailable = isBooked || isPast;
                const selected = time === slot.value;
                const note = "note" in slot ? slot.note : undefined;
                return (
                  <Button
                    variant="portal"
                    size="portal"
                    key={slot.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={unavailable}
                    onClick={() => onTimeChange(slot.value)}
                    className={[
                      "flex min-h-14 flex-col items-start justify-center gap-0.5 rounded-lg border px-3 py-2.5 text-left transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                      selected && "border-primary bg-primary text-primary-foreground",
                      !selected &&
                        !unavailable &&
                        "border-border/80 bg-card text-primary hover:border-input",
                      unavailable &&
                        "cursor-not-allowed border-dashed border-border bg-muted text-muted-foreground",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <span className="flex w-full items-center justify-between gap-2">
                      <span
                        className={[
                          "text-sm font-medium tabular-nums",
                          unavailable && "line-through decoration-input",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        {slot.label}
                      </span>
                      {isBooked && (
                        <Badge
                          variant="outline"
                          className="h-5 border-border px-1.5 text-[10px] font-medium text-muted-foreground"
                        >
                          Booked
                        </Badge>
                      )}
                      {!isBooked && isPast && (
                        <span className="text-[10px] font-medium text-muted-foreground">
                          Passed
                        </span>
                      )}
                    </span>
                    {note && (
                      <span
                        className={[
                          "text-[11px]",
                          selected ? "text-primary-foreground/70" : "text-muted-foreground",
                        ].join(" ")}
                      >
                        {note}
                      </span>
                    )}
                  </Button>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border px-4 py-12 text-center">
              <CalendarDays className="size-5 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">
                Choose a date on the calendar to see available times.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Step 4 — Details                                                   */
/* ------------------------------------------------------------------ */

function DetailsStep({
  form,
  errors,
  onChange,
  onBlur,
  onSubmit,
  isSubmitting,
  submitError,
  serviceName,
  scheduleLabel,
  estimateLabel,
}: {
  form: FormFields;
  errors: FormErrors;
  onChange: (field: keyof FormFields, value: string) => void;
  onBlur: (field: keyof FormFields) => void;
  onSubmit: (event: FormEvent) => void;
  isSubmitting: boolean;
  submitError: string | null;
  serviceName: string;
  scheduleLabel: string;
  estimateLabel: string;
}) {
  return (
    <section>
      <StepHeading
        title="Your details"
        description="We'll confirm your consultation on WhatsApp and email."
      />
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField id="clientName" label="Full name" required error={errors.clientName}>
            <Input
              id="clientName"
              autoComplete="name"
              placeholder="Nur Aisyah binti Ahmad"
              value={form.clientName}
              onChange={(e) => onChange("clientName", e.target.value)}
              onBlur={() => onBlur("clientName")}
              aria-invalid={Boolean(errors.clientName)}
              aria-describedby={errors.clientName ? "clientName-error" : undefined}
            />
          </FormField>
          <FormField id="companyName" label="Business / brand name" optional>
            <Input
              id="companyName"
              autoComplete="organization"
              placeholder="Optional"
              value={form.companyName}
              onChange={(e) => onChange("companyName", e.target.value)}
            />
          </FormField>
          <FormField
            id="whatsappNumber"
            label="WhatsApp number"
            required
            error={errors.whatsappNumber}
          >
            <div className="flex">
              <span className="inline-flex items-center rounded-l-md border border-r-0 border-border bg-muted px-3 text-sm font-medium text-muted-foreground">
                +673
              </span>
              <Input
                id="whatsappNumber"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                placeholder="712 3456"
                maxLength={9}
                value={form.whatsappNumber}
                onChange={(e) => onChange("whatsappNumber", e.target.value.replace(/[^\d\s]/g, ""))}
                onBlur={() => onBlur("whatsappNumber")}
                className="rounded-l-none"
                aria-invalid={Boolean(errors.whatsappNumber)}
                aria-describedby={errors.whatsappNumber ? "whatsappNumber-error" : undefined}
              />
            </div>
          </FormField>
          <FormField id="email" label="Email address" required error={errors.email}>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              value={form.email}
              onChange={(e) => onChange("email", e.target.value)}
              onBlur={() => onBlur("email")}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? "email-error" : undefined}
            />
          </FormField>
        </div>
        <FormField id="projectBrief" label="Project brief / reference links" optional>
          <Textarea
            id="projectBrief"
            rows={4}
            placeholder="Tell us about your goals, audience, and any reference videos or mood boards."
            value={form.projectBrief}
            onChange={(e) => onChange("projectBrief", e.target.value)}
          />
        </FormField>

        <div className="rounded-lg border border-border/80 bg-muted/60 p-4">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Final review
          </p>
          <dl className="grid gap-2 text-sm sm:grid-cols-3">
            <ReviewItem label="Service" value={serviceName} />
            <ReviewItem label="Consultation" value={scheduleLabel} />
            <ReviewItem label="Estimate" value={estimateLabel} />
          </dl>
        </div>

        {submitError && (
          <p
            role="alert"
            className="rounded-lg border border-destructive bg-destructive-muted px-3 py-2 text-sm text-destructive"
          >
            {submitError}
          </p>
        )}

        <Button type="submit" size="lg" disabled={isSubmitting} className="h-11 w-full">
          {isSubmitting ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Confirming booking…
            </>
          ) : (
            <>
              <CalendarCheck className="size-4" aria-hidden="true" />
              Confirm Booking & Lock Estimate
            </>
          )}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          No payment required today. Your estimate is held for 14 days.
        </p>
      </form>
    </section>
  );
}

function FormField({
  id,
  label,
  required,
  optional,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  optional?: boolean;
  error?: string | undefined;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className="text-foreground">
        {label}
        {required && (
          <span className="text-destructive" aria-hidden="true">
            *
          </span>
        )}
        {optional && <span className="font-normal text-muted-foreground">(optional)</span>}
      </Label>
      {children}
      {error && (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium text-primary">{value || "—"}</dd>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Estimate summary (desktop card + mobile drawer)                    */
/* ------------------------------------------------------------------ */

function EstimateSummary({
  items,
  min,
  max,
  scheduleLabel,
}: {
  items: LineItem[];
  min: number;
  max: number;
  scheduleLabel: string | null;
}) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 border-b border-border/80 px-5 py-4">
        <Receipt className="size-4 text-muted-foreground" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-foreground">Live Estimate Breakdown</h2>
      </div>

      <div className="flex flex-col gap-4 px-5 py-5">
        {items.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            Select a service to start building your estimate.
          </p>
        ) : (
          <ul className="flex flex-col gap-2.5" aria-label="Itemised selections">
            {items.map((item) => (
              <li key={item.label} className="flex items-start justify-between gap-4 text-sm">
                <span className="text-muted-foreground">{item.label}</span>
                <span className="shrink-0 font-medium tabular-nums text-primary">
                  {item.amount === 0 ? "Included" : formatBnd(item.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2.5 text-sm">
          <CalendarDays
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">Consultation</span>
            <span className="font-medium text-primary">{scheduleLabel ?? "Not selected yet"}</span>
          </div>
        </div>

        <div className="border-t border-dashed border-border pt-4">
          <span className="text-xs text-muted-foreground">Estimated range (± 15%)</span>
          <p
            className="mt-1 text-2xl font-semibold tracking-normal tabular-nums text-foreground"
            aria-live="polite"
          >
            {items.length === 0
              ? `${STUDIO_CONFIG.currencyPrefix} —`
              : `${formatBnd(min)} – ${formatBnd(max)}`}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-border/80 bg-muted/60 px-5 py-4">
        <TrustBadge icon={ShieldCheck} label="No payment required today" />
        <TrustBadge icon={Zap} label="Instant BND quote" />
      </div>
    </div>
  );
}

function TrustBadge({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
      <Icon className="size-3.5 text-success" aria-hidden="true" />
      {label}
    </span>
  );
}

function MobileEstimateBar({
  open,
  onOpenChange,
  items,
  min,
  max,
  scheduleLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: LineItem[];
  min: number;
  max: number;
  scheduleLabel: string | null;
}) {
  return (
    <div className="lg:hidden">
      {open && (
        <div
          className="animate-in fade-in fixed inset-0 z-40 bg-foreground/30 backdrop-blur-[2px] duration-200"
          onClick={() => onOpenChange(false)}
          aria-hidden="true"
        />
      )}
      <div className="fixed inset-x-0 bottom-0 z-50">
        {open && (
          <div
            id="mobile-estimate-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Estimate breakdown"
            className="animate-in slide-in-from-bottom-8 fade-in max-h-[70vh] overflow-y-auto rounded-t-2xl border border-b-0 border-border/80 bg-card shadow-2xl duration-300"
          >
            <div className="flex justify-end px-3 pt-3">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
                aria-label="Close breakdown"
              >
                <X className="size-4" aria-hidden="true" />
              </Button>
            </div>
            <EstimateSummary items={items} min={min} max={max} scheduleLabel={scheduleLabel} />
          </div>
        )}
        <Button
          variant="portal"
          size="portal"
          type="button"
          onClick={() => onOpenChange(!open)}
          aria-expanded={open}
          aria-controls="mobile-estimate-drawer"
          className="flex w-full items-center justify-between gap-4 border-t border-border/80 bg-card/95 px-5 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] text-left shadow-sm backdrop-blur"
        >
          <span className="flex flex-col">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Live estimate
            </span>
            <span className="text-lg font-semibold tabular-nums text-foreground">
              {items.length === 0
                ? `${STUDIO_CONFIG.currencyPrefix} —`
                : `${formatBnd(min)} – ${formatBnd(max)}`}
            </span>
          </span>
          <span className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground">
            {open ? "Hide" : "Breakdown"}
            <ChevronUp
              className={["size-3.5 transition-transform", open ? "rotate-180" : ""].join(" ")}
              aria-hidden="true"
            />
          </span>
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Step 5 — Confirmation                                              */
/* ------------------------------------------------------------------ */

function buildSummaryText(booking: BookingSubmission, items: LineItem[]) {
  const lines = [
    `Booking Reference: ${booking.referenceId}`,
    ``,
    `Client: ${booking.clientName}${booking.companyName ? ` (${booking.companyName})` : ""}`,
    `WhatsApp: ${booking.whatsappNumber}`,
    `Email: ${booking.email}`,
    ``,
    `Service: ${booking.serviceName}`,
    `Scale: ${booking.durationLabel}`,
    `Locations: ${booking.locationCount}${booking.outsideBruneiMuara ? " (incl. travel outside Brunei-Muara)" : ""}`,
    `Add-ons: ${booking.selectedAddons.length ? booking.selectedAddons.join(", ") : "None"}`,
    ``,
    `Itemised:`,
    ...items.map((i) => `  - ${i.label}: ${i.amount === 0 ? "Included" : formatBnd(i.amount)}`),
    ``,
    `Estimate: ${formatBnd(booking.estimatedMinBnd)} – ${formatBnd(booking.estimatedMaxBnd)}`,
    `Consultation: ${booking.bookingDate} at ${booking.bookingTime} (GMT+8)`,
  ];
  if (booking.projectBrief) lines.push(``, `Brief: ${booking.projectBrief}`);
  return lines.join("\n");
}

function ConfirmationCard({
  booking,
  items,
  merchantWhatsapp,
  onReset,
}: {
  booking: BookingSubmission;
  items: LineItem[];
  merchantWhatsapp: string;
  onReset: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [year = 2026, month = 1, day = 1] = booking.bookingDate.split("-").map(Number);
  const displayDate = formatLongDate(new Date(year, month - 1, day));
  const summary = buildSummaryText(booking, items);

  const handleCopy = async () => {
    const ok = await copyText(summary);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleWhatsapp = () => {
    const message = [
      `Hi! I've just booked a consultation.`,
      `Reference: ${booking.referenceId}`,
      `Service: ${booking.serviceName} — ${booking.durationLabel}`,
      `Locations: ${booking.locationCount}${booking.outsideBruneiMuara ? " (outside Brunei-Muara)" : ""}`,
      booking.selectedAddons.length ? `Add-ons: ${booking.selectedAddons.join(", ")}` : null,
      `Estimate: ${formatBnd(booking.estimatedMinBnd)} – ${formatBnd(booking.estimatedMaxBnd)}`,
      `Consultation: ${displayDate}, ${booking.bookingTime} (GMT+8)`,
      `Name: ${booking.clientName}`,
    ]
      .filter(Boolean)
      .join("\n");
    const digits = merchantWhatsapp.replace(/\D/g, "");
    window.open(
      `https://wa.me/${digits}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  return (
    <Card className="animate-in fade-in zoom-in-95 mx-auto w-full max-w-xl gap-0 overflow-hidden border-border/80 bg-card p-0 shadow-sm ring-0 duration-500">
      <div className="flex flex-col items-center gap-4 border-b border-border/80 bg-gradient-to-b from-success-muted/70 to-card px-6 pb-8 pt-10 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-success text-primary-foreground shadow-lg shadow-success/20">
          <Check className="size-7" strokeWidth={2.5} aria-hidden="true" />
        </span>
        <div className="flex flex-col gap-1.5">
          <h1 className="text-balance text-2xl font-semibold tracking-normal text-foreground">
            Booking request received
          </h1>
          <p className="text-pretty text-sm text-muted-foreground">
            Thanks, {booking.clientName.split(" ")[0]}. We&apos;ll reach out on WhatsApp shortly to
            confirm your consultation.
          </p>
        </div>
        <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-input bg-card px-6 py-3">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Reference code
          </span>
          <span className="font-mono text-xl font-semibold tracking-wider text-foreground">
            {booking.referenceId}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-5 px-6 py-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-start gap-3 rounded-lg bg-muted p-3">
            <CalendarDays className="mt-0.5 size-4 text-muted-foreground" aria-hidden="true" />
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Consultation</span>
              <span className="text-sm font-medium text-primary">{displayDate}</span>
              <span className="text-sm text-muted-foreground">{booking.bookingTime} · GMT+8</span>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-lg bg-muted p-3">
            <FileText className="mt-0.5 size-4 text-muted-foreground" aria-hidden="true" />
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Service</span>
              <span className="text-sm font-medium text-primary">{booking.serviceName}</span>
              <span className="text-sm text-muted-foreground">
                {booking.locationCount} location{booking.locationCount > 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </div>

        <ul className="flex flex-col gap-2.5" aria-label="Itemised estimate">
          {items.map((item) => (
            <li key={item.label} className="flex items-start justify-between gap-4 text-sm">
              <span className="text-muted-foreground">{item.label}</span>
              <span className="shrink-0 font-medium tabular-nums text-primary">
                {item.amount === 0 ? "Included" : formatBnd(item.amount)}
              </span>
            </li>
          ))}
        </ul>

        <div className="flex items-end justify-between gap-4 border-t border-dashed border-border pt-4">
          <span className="text-sm text-muted-foreground">Locked estimate (± 15%)</span>
          <span className="text-xl font-semibold tracking-normal tabular-nums text-foreground">
            {formatBnd(booking.estimatedMinBnd)} – {formatBnd(booking.estimatedMaxBnd)}
          </span>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Button type="button" variant="outline" onClick={handleCopy} className="h-10">
            {copied ? (
              <>
                <Check className="size-4 text-success" aria-hidden="true" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="size-4" aria-hidden="true" />
                Copy Summary
              </>
            )}
          </Button>
          <Button
            type="button"
            onClick={handleWhatsapp}
            className="h-10 bg-success text-primary-foreground hover:bg-success"
          >
            <MessageCircle className="size-4" aria-hidden="true" />
            Send via WhatsApp
          </Button>
        </div>
        <span className="sr-only" aria-live="polite">
          {copied ? "Summary copied to clipboard" : ""}
        </span>

        <Button
          variant="portal"
          size="portal"
          type="button"
          onClick={onReset}
          className="text-center text-xs font-medium text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
        >
          Start a new estimate
        </Button>
      </div>
    </Card>
  );
}
