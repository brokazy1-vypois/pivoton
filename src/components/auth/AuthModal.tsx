import { useEffect, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatAuthError } from "@/lib/auth-errors";
import { useAuth, DEMO_ACCOUNTS } from "@/context/AuthContext";

type ModalView = "auth" | "forgot-password";

const RESEND_COOLDOWN_SECONDS = 60;

function formatCountdown(seconds: number): string {
  return `00:${String(seconds).padStart(2, "0")}`;
}

export function AuthModal() {
  const {
    authModalOpen,
    authPrompt,
    closeAuthModal,
    signIn,
    signUp,
    requestPasswordReset,
    demoLogin,
  } = useAuth();
  const [modalView, setModalView] = useState<ModalView>("auth");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [signUpName, setSignUpName] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotStatus, setForgotStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle",
  );
  const [forgotMessage, setForgotMessage] = useState("");
  const [hasSentResetLink, setHasSentResetLink] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);

  const resetForgotPasswordState = () => {
    setForgotStatus("idle");
    setForgotMessage("");
    setHasSentResetLink(false);
    setResendCountdown(0);
  };

  useEffect(() => {
    if (!authModalOpen) {
      setModalView("auth");
      resetForgotPasswordState();
    }
  }, [authModalOpen]);

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = window.setTimeout(() => {
      setResendCountdown((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [resendCountdown]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await signIn(signInEmail, signInPassword);
      toast.success("Signed in successfully");
    } catch (err) {
      toast.error(formatAuthError(err, "Sign in failed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await signUp(signUpEmail, signUpPassword, signUpName);
      toast.success("Account created — welcome to Pivoton");
    } catch (err) {
      toast.error(formatAuthError(err, "Sign up failed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotStatus("loading");
    setForgotMessage("");
    try {
      await requestPasswordReset(forgotEmail);
      setForgotStatus("success");
      setForgotMessage("Reset link sent to your email!");
      setHasSentResetLink(true);
      setResendCountdown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setForgotStatus("error");
      setForgotMessage(err instanceof Error ? err.message : "Failed to send reset link");
    }
  };

  const handleDemo = async (index: number) => {
    setIsSubmitting(true);
    try {
      await demoLogin(DEMO_ACCOUNTS[index]);
      toast.success(`Logged in as ${DEMO_ACCOUNTS[index].fullName}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Demo login failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openForgotPassword = () => {
    setForgotEmail(signInEmail);
    resetForgotPasswordState();
    setModalView("forgot-password");
  };

  const backToSignIn = () => {
    setModalView("auth");
    resetForgotPasswordState();
  };

  const isResendCooldownActive = resendCountdown > 0;
  const forgotSubmitDisabled = forgotStatus === "loading" || isResendCooldownActive;
  const forgotSubmitLabel =
    forgotStatus === "loading"
      ? null
      : isResendCooldownActive
        ? `Resend available in ${formatCountdown(resendCountdown)}`
        : hasSentResetLink
          ? "Resend Reset Link"
          : "Send Reset Link";

  return (
    <Dialog open={authModalOpen} onOpenChange={(v) => !v && closeAuthModal()}>
      <DialogContent className="border-border/60 bg-[#0B132B] sm:max-w-md transition-all duration-300">
        {modalView === "forgot-password" ? (
          <>
            <DialogHeader>
              <DialogTitle className="font-display">Reset your password</DialogTitle>
              <DialogDescription>
                Enter your account email to receive a password reset link.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={(e) => void handleForgotPassword(e)} className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="forgot-email">Email</Label>
                <Input
                  id="forgot-email"
                  type="email"
                  placeholder="you@example.com"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  required
                  disabled={forgotStatus === "loading"}
                />
                {isResendCooldownActive && (
                  <p className="text-xs text-muted-foreground">
                    Didn&apos;t receive the email? Resend link in{" "}
                    {formatCountdown(resendCountdown)}
                  </p>
                )}
              </div>

              {forgotStatus === "success" && forgotMessage && (
                <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{forgotMessage}</span>
                </div>
              )}

              {forgotStatus === "error" && (
                <p className="text-sm text-destructive">{forgotMessage}</p>
              )}

              <Button
                type="submit"
                className="w-full bg-[#00E599] text-[#0B132B] hover:bg-[#00E599]/90 disabled:opacity-50"
                disabled={forgotSubmitDisabled}
              >
                {forgotStatus === "loading" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  forgotSubmitLabel
                )}
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="w-full text-muted-foreground hover:text-foreground"
                onClick={backToSignIn}
              >
                Back to Sign In
              </Button>
            </form>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="font-display">Welcome to Pivoton</DialogTitle>
              <DialogDescription>
                {authPrompt ?? "Sign in to post hopes, track your timeline, and join the community."}
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="signin" className="mt-2">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={(e) => void handleSignIn(e)} className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="you@example.com"
                      value={signInEmail}
                      onChange={(e) => setSignInEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="signin-password">Password</Label>
                      <button
                        type="button"
                        className="text-xs text-primary transition-colors hover:text-primary/80"
                        onClick={openForgotPassword}
                      >
                        Forgot Password?
                      </button>
                    </div>
                    <Input
                      id="signin-password"
                      type="password"
                      placeholder="••••••••"
                      value={signInPassword}
                      onChange={(e) => setSignInPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={(e) => void handleSignUp(e)} className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Full name</Label>
                    <Input
                      id="signup-name"
                      placeholder="Amelia Roux"
                      value={signUpName}
                      onChange={(e) => setSignUpName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="you@example.com"
                      value={signUpEmail}
                      onChange={(e) => setSignUpEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="Min. 6 characters"
                      minLength={6}
                      value={signUpPassword}
                      onChange={(e) => setSignUpPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create account"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            <div className="border-t border-border pt-4">
              <p className="mb-3 text-center text-xs text-muted-foreground">Quick demo login</p>
              <div className="grid gap-2">
                {DEMO_ACCOUNTS.map((account, i) => (
                  <Button
                    key={account.email}
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isSubmitting}
                    onClick={() => void handleDemo(i)}
                  >
                    Log in as {account.fullName}
                  </Button>
                ))}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
