import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { getSupabase } from "@/lib/supabase";

export const Route = createFileRoute("/auth/reset-password")({
  head: () => ({
    meta: [{ title: "Reset Password — Pivoton" }],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const { updatePassword } = useAuth();
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      setSessionError(
        "Authentication is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
      return;
    }

    let cancelled = false;

    const verifySession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (cancelled) return;

      if (error) {
        setSessionError(error.message);
        return;
      }

      if (session) {
        setSessionReady(true);
        return;
      }

      // Brief wait for detectSessionInUrl to parse recovery hash from email link
      await new Promise((resolve) => setTimeout(resolve, 500));
      const { data: { session: retrySession }, error: retryError } =
        await supabase.auth.getSession();
      if (cancelled) return;

      if (retryError) {
        setSessionError(retryError.message);
        return;
      }

      if (retrySession) {
        setSessionReady(true);
      } else {
        setSessionError(
          "This reset link is invalid or has expired. Request a new link from the sign-in page.",
        );
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setSessionReady(true);
        setSessionError(null);
      }
    });

    void verifySession();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (newPassword.length < 6) {
      setFormError("Password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setFormError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      await updatePassword(newPassword);
      toast.success("Password updated successfully");
      await navigate({ to: "/dashboard" });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to update password");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-5 py-16">
      <div className="w-full max-w-md rounded-lg border border-border/60 bg-[#0B132B] p-6 shadow-lg transition-all duration-300">
        <h1 className="font-display text-xl font-semibold">Set a new password</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Choose a strong password for your Pivoton account.
        </p>

        {!sessionReady && !sessionError && (
          <div className="mt-8 flex flex-col items-center gap-3 py-8 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-sm">Verifying reset link…</p>
          </div>
        )}

        {sessionError && (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-destructive">{sessionError}</p>
            <Button asChild variant="outline" className="w-full">
              <Link to="/">Back to home</Link>
            </Button>
          </div>
        )}

        {sessionReady && (
          <form onSubmit={(e) => void handleSubmit(e)} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="Min. 6 characters"
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="Re-enter your password"
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            {formError && <p className="text-sm text-destructive">{formError}</p>}

            <Button
              type="submit"
              className="w-full bg-[#00E599] text-[#0B132B] hover:bg-[#00E599]/90"
              disabled={isSubmitting}
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update password"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
