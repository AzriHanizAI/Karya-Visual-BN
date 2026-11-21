import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Aperture, ArrowUpRight, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useContext, createContext } from "react";
export const AccountContext = createContext(false);
export function StudioNav() {
  const signedIn = useContext(AccountContext);
  const cache = useQueryClient();
  const navigate = useNavigate();
  async function signOut() {
    await cache.cancelQueries();
    cache.clear();
    await supabase.auth.signOut();
    await navigate({ to: "/auth", replace: true });
  }
  return (
    <nav className="border-b bg-card">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Button variant="ghost" asChild>
          <Link to="/">
            <Aperture className="size-5" />
            Studio
            <span className="hidden text-xs font-normal text-muted-foreground sm:inline">
              {" "}
              / Production & photography
            </span>
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/admin">
              Admin Desk
              <ArrowUpRight />
            </Link>
          </Button>
          {signedIn && (
            <Button
              aria-label="Sign out"
              title="Sign out"
              variant="ghost"
              size="icon"
              onClick={signOut}
            >
              <LogOut />
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
}
