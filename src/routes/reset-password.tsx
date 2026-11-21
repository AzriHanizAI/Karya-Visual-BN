import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StudioNav } from "@/components/StudioNav";
export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Choose a New Password | Studio" },
      { name: "description", content: "Securely reset your Studio administrator password." },
      { property: "og:title", content: "Choose a New Password | Studio" },
      { property: "og:description", content: "Recover access to your Studio booking desk." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Reset,
});
function Reset() {
  const [valid, setValid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    const recovery = new URLSearchParams(window.location.hash.slice(1)).get("type") === "recovery";
    if (recovery) sessionStorage.setItem("studio-recovery", "true");
    supabase.auth
      .getUser()
      .then(({ data }) =>
        setValid(
          Boolean(data.user) && (recovery || sessionStorage.getItem("studio-recovery") === "true"),
        ),
      );
  }, []);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setMessage("Passwords do not match.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    sessionStorage.removeItem("studio-recovery");
    await navigate({ to: "/admin" });
  }
  return (
    <>
      <StudioNav />
      <main className="mx-auto max-w-md px-6 py-20">
        <h1 className="text-3xl font-semibold">Choose a new password</h1>
        {valid ? (
          <form onSubmit={submit} className="mt-8 space-y-5">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              minLength={8}
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Label htmlFor="confirm-password">Confirm password</Label>
            <Input
              id="confirm-password"
              type="password"
              minLength={8}
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            {message && <p role="alert">{message}</p>}
            <Button disabled={busy}>{busy ? "Saving…" : "Save new password"}</Button>
          </form>
        ) : (
          <p className="mt-6 text-muted-foreground">
            Open the secure link from your reset email. If it has expired, request a new link from
            sign in.
          </p>
        )}
      </main>
    </>
  );
}
