import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Search, RefreshCw, ClipboardList } from "lucide-react";
import { StudioNav } from "@/components/StudioNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listBookings, updateBookingStatus } from "@/lib/bookings.functions";
import { BOOKING_STATUSES, type BookingStatus } from "@/lib/studio";
import type { Tables } from "@/integrations/supabase/types";
const options = queryOptions({ queryKey: ["admin-bookings"], queryFn: () => listBookings() });
export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin Booking Desk | Studio" },
      {
        name: "description",
        content: "Review Studio clients, estimates, and appointment statuses.",
      },
      { property: "og:title", content: "Admin Booking Desk | Studio" },
      { property: "og:description", content: "Private consultation management for Studio." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(options),
  component: Admin,
  errorComponent: ({ error, reset }) => (
    <>
      <StudioNav />
      <main className="mx-auto max-w-6xl p-8">
        <h1 className="text-2xl font-semibold">Admin Booking Desk</h1>
        <p role="alert" className="my-6 text-muted-foreground">
          {error instanceof Error ? error.message : "Could not load the booking desk."}
        </p>
        <Button onClick={reset}>Try again</Button>
      </main>
    </>
  ),
});
function Admin() {
  const { data: bookings } = useSuspenseQuery(options);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Tables<"bookings"> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const cache = useQueryClient();
  const update = useServerFn(updateBookingStatus);
  const rows = bookings.filter(
    (b) =>
      (filter === "all" || b.status === filter) &&
      `${b.client_name} ${b.email} ${b.reference_id} ${b.service_name}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  async function change(id: string, status: BookingStatus) {
    setBusy(true);
    setError("");
    try {
      await update({ data: { id, status } });
      await cache.invalidateQueries({ queryKey: ["admin-bookings"] });
      await cache.invalidateQueries({ queryKey: ["booked-slots"] });
      setSelected((b) => (b?.id === id ? { ...b, status } : b));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <StudioNav />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
              <ClipboardList />
              Consultations
            </div>
            <h1 className="text-3xl font-semibold">Admin Booking Desk</h1>
            <p className="mt-2 text-muted-foreground">
              {bookings.length} requests · {bookings.filter((b) => b.status === "pending").length}{" "}
              awaiting confirmation
            </p>
          </div>
          <Button
            variant="outline"
            size="icon"
            title="Refresh bookings"
            aria-label="Refresh bookings"
            onClick={() => cache.invalidateQueries({ queryKey: ["admin-bookings"] })}
          >
            <RefreshCw />
          </Button>
        </div>
        <div className="mb-6 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
            <Input
              aria-label="Search bookings"
              className="pl-9"
              placeholder="Search clients, references or services"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="sm:w-48" aria-label="Filter booking status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {BOOKING_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s[0]?.toUpperCase()}
                  {s.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {error && (
          <p role="alert" className="mb-4 text-destructive">
            {error}
          </p>
        )}
        <div className="overflow-x-auto border-y">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                {["Client / Reference", "Service", "Consultation", "Estimate", "Status", ""].map(
                  (h) => (
                    <th className="whitespace-nowrap px-4 py-3 font-medium" key={h}>
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id} className="border-t">
                  <td className="px-4 py-5">
                    <span className="block font-medium">{b.client_name}</span>
                    <span className="text-xs text-muted-foreground">{b.reference_id}</span>
                  </td>
                  <td className="max-w-60 px-4 py-5">{b.service_name}</td>
                  <td className="whitespace-nowrap px-4 py-5">
                    {b.booking_date}
                    <br />
                    <span className="text-muted-foreground">{b.booking_time}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-5">
                    B$ {b.estimated_min_bnd} – {b.estimated_max_bnd}
                  </td>
                  <td className="px-4 py-5">
                    <Badge variant={b.status === "pending" ? "secondary" : "outline"}>
                      {b.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-5">
                    <Button variant="outline" size="sm" onClick={() => setSelected(b)}>
                      View details
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && (
            <p className="py-16 text-center text-muted-foreground">
              {bookings.length
                ? "No bookings match your filters."
                : "No consultation requests yet."}
            </p>
          )}
        </div>
        <Dialog
          open={Boolean(selected)}
          onOpenChange={(open) => {
            if (!open) setSelected(null);
          }}
        >
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selected?.client_name}</DialogTitle>
            </DialogHeader>
            {selected && (
              <div className="space-y-5 text-sm">
                <p className="text-muted-foreground">
                  {selected.reference_id} · {selected.booking_date} · {selected.booking_time}
                </p>
                <dl className="grid grid-cols-2 gap-4">
                  {[
                    ["Email", selected.email],
                    ["WhatsApp", selected.whatsapp_number],
                    ["Company", selected.company_name || "—"],
                    ["Service", selected.service_name],
                    ["Duration", selected.duration_label],
                    [
                      "Locations",
                      `${selected.location_count}${selected.outside_brunei_muara ? " · Outside Brunei-Muara" : ""}`,
                    ],
                    [
                      "Estimate",
                      `B$ ${selected.estimated_min_bnd} – ${selected.estimated_max_bnd}`,
                    ],
                    ["Add-ons", selected.selected_addons.join(", ") || "None"],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-xs text-muted-foreground">{label}</dt>
                      <dd className="mt-1 break-words font-medium">{value}</dd>
                    </div>
                  ))}
                </dl>
                <div>
                  <h2 className="mb-2 font-medium">Project brief</h2>
                  <p className="whitespace-pre-wrap break-words text-muted-foreground">
                    {selected.project_brief || "No brief provided."}
                  </p>
                </div>
                <div className="border-t pt-4">
                  <p className="mb-2 font-medium">Appointment status</p>
                  <Select
                    disabled={busy}
                    value={selected.status}
                    onValueChange={(s) => {
                      if (BOOKING_STATUSES.some((v) => v === s))
                        change(selected.id, s as BookingStatus);
                    }}
                  >
                    <SelectTrigger aria-label="Appointment status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BOOKING_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {error && (
                    <p role="alert" className="mt-2 text-destructive">
                      {error}
                    </p>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </>
  );
}
