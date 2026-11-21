import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { LockKeyhole, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StudioNav } from "@/components/StudioNav";

type Mode = "signin" | "signup" | "reset";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Admin Sign In | Studio" },
      { name: "description", content: "Secure sign in for the Studio booking desk." },
      { property: "og:title", content: "Admin Sign In | Studio" },
      { property: "og:description", content: "Manage Studio consultation requests securely." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Auth,
});

function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [mode, setMode] = useState<Mode>("signin");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) void navigate({ to: "/admin" });
    });
  }, [navigate]);

  function switchMode(next: Mode) {
    setMode(next);
    setMessage("");
    setPassword("");
    setConfirm("");
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setMessage("Check your email for a password reset link.");
      } else if (mode === "signup") {
        if (password.length < 8) throw new Error("Choose a password of at least 8 characters.");
        if (password !== confirm) throw new Error("The two passwords do not match.");
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth` },
        });
        if (error) throw error;
        if (data.session) {
          await navigate({ to: "/admin" });
          return;
        }
        setMessage(
          "Now open your email and click the confirmation link, then come back and sign in.",
        );
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await navigate({ to: "/admin" });
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <StudioNav />
      <main className="mx-auto max-w-md px-6 py-20">
        <LockKeyhole className="mb-6 size-8 text-primary" />
        <h1 className="text-3xl font-semibold">
          {mode === "signup"
            ? "Create your admin account"
            : mode === "reset"
              ? "Reset your password"
              : "Admin sign in"}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {mode === "signup"
            ? "Only the email address approved for this studio is given booking desk access."
            : mode === "reset"
              ? "We’ll email you a secure reset link."
              : "Your private Studio booking desk."}
        </p>
        <form onSubmit={submit} className="mt-8 flex flex-col gap-5">
          <div className="space-y-2">
            <Label htmlFor="admin-email">Email address</Label>
            <Input
              id="admin-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          {mode !== "reset" && (
            <div className="space-y-2">
              <Label htmlFor="admin-password">{mode === "signup" ? "Choose a password" : "Password"}</Label>
              <Input
                id="admin-password"
                type="password"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          )}
          {mode === "signup" && (
            <div className="space-y-2">
              <Label htmlFor="admin-confirm">Confirm your password</Label>
              <Input
                id="admin-confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>
          )}
          {message && (
            <p role="status" className="text-sm text-muted-foreground">
              {message}
            </p>
          )}
          <Button disabled={busy}>
            {busy
              ? "Please wait…"
              : mode === "signup"
                ? "Create account"
                : mode === "reset"
                  ? "Send reset link"
                  : "Sign in"}
            <ArrowRight />
          </Button>
          {mode === "signin" && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button type="button" variant="link" onClick={() => switchMode("signup")}>
                Create admin account
              </Button>
              <Button type="button" variant="link" onClick={() => switchMode("reset")}>
                Forgot password?
              </Button>
            </div>
          )}
          {mode !== "signin" && (
            <Button type="button" variant="link" onClick={() => switchMode("signin")}>
              Back to sign in
            </Button>
          )}
        </form>
      </main>
    </>
  );
}
