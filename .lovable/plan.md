# Admin Booking Desk refinements

1. **Estimate formatting** — show estimates as `B$ 1,970 – 2,670` in the table and in the details popup.
2. **Clickable contacts** — in the details popup, the WhatsApp number opens `https://wa.me/673…` in a new tab and the email opens `mailto:…`.
3. **"Confirm & Reply on WhatsApp" button** — next to the status dropdown. One click sets the booking to `confirmed`, refreshes the list, and opens WhatsApp to the client with:
   "Hi {client_name}, your consultation ({reference_id}) for {service_name} on {booking_date} at {booking_time} (GMT+8) is confirmed! Looking forward to speaking with you."
   The WhatsApp tab opens immediately on click (so pop-up blockers don't stop it); if saving fails, an error shows in the popup. Disabled while saving or when already confirmed.
4. **No more sign-up** — remove "Create admin account" and the sign-up mode from the sign-in page. Sign-in and "Forgot password?" remain. The owner account (deadly8803494@gmail.com) already exists and is confirmed, so access is unaffected. Sign-ups will also be turned off in the backend auth settings, so new accounts can't be created by bypassing the page.

## Technical details
- Add `formatBnd(n)` (`toLocaleString("en-US")`) and `whatsappLink(number, text?)` (strip `+`/non-digits, `encodeURIComponent` text) to `src/lib/studio.ts`, with a small test in `src/test/booking-rules.test.ts`.
- `admin.tsx`: reuse existing `change(id, "confirmed")`; open `window.open(url, "_blank", "noopener")` synchronously before awaiting.
- `auth.tsx`: Mode becomes `"signin" | "reset"`.
- `supabase--configure_auth`: disable signups.
