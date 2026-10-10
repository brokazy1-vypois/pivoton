import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { logAuthDiagnostics } from "@/lib/auth-diagnostics";
import { isAuthNetworkError, isAuthStorageError } from "@/lib/auth-errors";
import {
  readAuthStorageJson,
  readAuthStorageString,
  removeAuthStorageKey,
  writeAuthStorageJson,
} from "@/lib/auth-storage";
import { registerLocalUser, signInLocalUser } from "@/lib/local-auth";
import { getPasswordResetRedirectUrl } from "@/lib/auth-reset";
import {
  disposeSupabaseAuth,
  getSupabase,
  isSupabaseAuthReachable,
  isSupabaseConfigured,
} from "@/lib/supabase";
import { DEMO_ACCOUNTS, type AppUser, type DemoAccount, type SubscriptionStatus } from "@/types/hope-post";

const allowLocalAuthFallback = import.meta.env.DEV;

const LOCAL_SESSION_KEY = "pivoton-auth-session";
const SUBSCRIPTION_KEY_PREFIX = "pivoton-subscription";

function loadSubscriptionStatus(userId: string): SubscriptionStatus {
  if (typeof window === "undefined") return "free";
  const key = `${SUBSCRIPTION_KEY_PREFIX}_${userId}`;
  const raw = readAuthStorageString(key);
  if (raw === "premium" || raw === "broker_pro" || raw === "free") return raw;
  const parsed = readAuthStorageJson<string>(key);
  if (parsed === "premium" || parsed === "broker_pro" || parsed === "free") return parsed;
  return "free";
}

function saveSubscriptionStatus(userId: string, status: SubscriptionStatus) {
  writeAuthStorageJson(`${SUBSCRIPTION_KEY_PREFIX}_${userId}`, status);
}

function withSubscription(user: AppUser): AppUser {
  const subscriptionStatus = loadSubscriptionStatus(user.id);
  const rolePremium = user.role?.toLowerCase().includes("premium") ?? false;
  const isPremium =
    subscriptionStatus === "premium" ||
    subscriptionStatus === "broker_pro" ||
    rolePremium;

  return {
    ...user,
    subscriptionStatus: isPremium && subscriptionStatus === "free" ? "premium" : subscriptionStatus,
    isPremium,
  };
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function userFromSession(session: Session): AppUser {
  const meta = session.user.user_metadata as { full_name?: string; role?: string };
  const fullName = meta.full_name ?? session.user.email?.split("@")[0] ?? "User";
  return withSubscription({
    id: session.user.id,
    email: session.user.email ?? "",
    fullName,
    avatar: initials(fullName),
    role: meta.role,
  });
}

function userFromDemo(account: DemoAccount): AppUser {
  const isPremiumRole = account.role.toLowerCase().includes("premium");
  return withSubscription({
    id: `demo-${account.email.split("@")[0]}`,
    email: account.email,
    fullName: account.fullName,
    avatar: initials(account.fullName),
    role: account.role,
    ...(isPremiumRole
      ? { subscriptionStatus: "premium" as const, isPremium: true }
      : {}),
  });
}

function loadLocalSession(): AppUser | null {
  const user = readAuthStorageJson<AppUser>(LOCAL_SESSION_KEY);
  return user ? withSubscription(user) : null;
}

function saveLocalSession(user: AppUser | null) {
  if (user) writeAuthStorageJson(LOCAL_SESSION_KEY, user);
  else removeAuthStorageKey(LOCAL_SESSION_KEY);
}

interface AuthContextValue {
  user: AppUser | null;
  session: Session | null;
  isLoading: boolean;
  authModalOpen: boolean;
  authPrompt: string | null;
  openAuthModal: (prompt?: string) => void;
  closeAuthModal: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  demoLogin: (account: DemoAccount) => Promise<void>;
  signOut: () => Promise<void>;
  upgradeToPremium: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function shouldUseLocalFallback(error: unknown): boolean {
  return allowLocalAuthFallback && (isAuthNetworkError(error) || isAuthStorageError(error));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authPrompt, setAuthPrompt] = useState<string | null>(null);

  useEffect(() => {
    logAuthDiagnostics("AuthProvider mount");

    const supabase = getSupabase();

    if (!supabase) {
      setUser(loadLocalSession());
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          logAuthDiagnostics("getSession failed on init", { error: error.message });
          setUser(loadLocalSession());
          return;
        }
        if (data.session) {
          setSession(data.session);
          setUser(userFromSession(data.session));
        } else {
          setUser(loadLocalSession());
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      logAuthDiagnostics("onAuthStateChange", { event, hasSession: Boolean(nextSession) });
      setSession(nextSession);
      if (nextSession) {
        setUser(userFromSession(nextSession));
        saveLocalSession(null);
      } else if (!loadLocalSession()) {
        setUser(null);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      disposeSupabaseAuth();
    };
  }, []);

  const openAuthModal = useCallback((prompt?: string) => {
    setAuthPrompt(prompt ?? null);
    setAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setAuthModalOpen(false);
    setAuthPrompt(null);
  }, []);

  const completeLocalSignIn = useCallback(
    (localUser: AppUser) => {
      saveLocalSession(localUser);
      setUser(localUser);
      setSession(null);
      closeAuthModal();
    },
    [closeAuthModal],
  );

  const signIn = useCallback(
    async (email: string, password: string) => {
      const supabase = getSupabase();

      if (!supabase) {
        if (allowLocalAuthFallback) {
          const localUser = signInLocalUser(email, password);
          if (!localUser) {
            throw new Error("Invalid email or password for this local dev account.");
          }
          completeLocalSignIn(localUser);
          return;
        }
        throw new Error(
          "Authentication is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your deployment environment.",
        );
      }

      logAuthDiagnostics("signIn attempt");

      try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (!data.session) {
          throw new Error("Sign in succeeded but no session was returned. Try again.");
        }
        setSession(data.session);
        setUser(userFromSession(data.session));
        saveLocalSession(null);
        closeAuthModal();
      } catch (error) {
        logAuthDiagnostics("signIn failed", {
          error: error instanceof Error ? error.message : String(error),
        });

        if (shouldUseLocalFallback(error)) {
          const reachable = await isSupabaseAuthReachable();
          const localUser = signInLocalUser(email, password);
          if (localUser) {
            logAuthDiagnostics("signIn local fallback", { reachable });
            completeLocalSignIn(localUser);
            return;
          }
          if (!reachable) {
            throw new Error(
              "Cannot reach Supabase authentication and no matching local dev account was found. Check NEXT_PUBLIC_SUPABASE_URL or create an account on the Sign Up tab.",
            );
          }
        }
        throw error;
      }
    },
    [closeAuthModal, completeLocalSignIn],
  );

  const signUp = useCallback(
    async (email: string, password: string, fullName: string) => {
      const supabase = getSupabase();

      if (!supabase) {
        if (allowLocalAuthFallback) {
          completeLocalSignIn(registerLocalUser(email, password, fullName));
          return;
        }
        throw new Error(
          "Authentication is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your deployment environment.",
        );
      }

      logAuthDiagnostics("signUp attempt");

      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        });
        if (error) throw error;

        if (data.session) {
          setSession(data.session);
          setUser(userFromSession(data.session));
          saveLocalSession(null);
          closeAuthModal();
          return;
        }

        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        if (!signInData.session) {
          throw new Error(
            "Account created. Check your email to confirm, then sign in.",
          );
        }
        setSession(signInData.session);
        setUser(userFromSession(signInData.session));
        saveLocalSession(null);
        closeAuthModal();
      } catch (error) {
        logAuthDiagnostics("signUp failed", {
          error: error instanceof Error ? error.message : String(error),
        });

        if (shouldUseLocalFallback(error)) {
          completeLocalSignIn(registerLocalUser(email, password, fullName));
          return;
        }
        throw error;
      }
    },
    [closeAuthModal, completeLocalSignIn],
  );

  const requestPasswordReset = useCallback(async (email: string) => {
    const supabase = getSupabase();
    if (!supabase) {
      throw new Error(
        "Authentication is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your deployment environment.",
      );
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getPasswordResetRedirectUrl(),
    });
    if (error) throw error;
  }, []);

  const updatePassword = useCallback(async (newPassword: string) => {
    const supabase = getSupabase();
    if (!supabase) {
      throw new Error(
        "Authentication is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your deployment environment.",
      );
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  }, []);

  const demoLogin = useCallback(
    async (account: DemoAccount) => {
      const supabase = getSupabase();

      if (supabase) {
        try {
          let { error } = await supabase.auth.signInWithPassword({
            email: account.email,
            password: account.password,
          });

          if (error) {
            const { error: signUpError } = await supabase.auth.signUp({
              email: account.email,
              password: account.password,
              options: { data: { full_name: account.fullName, role: account.role } },
            });
            if (signUpError && !signUpError.message.includes("already registered")) {
              // fall through to local demo
            } else {
              const retry = await supabase.auth.signInWithPassword({
                email: account.email,
                password: account.password,
              });
              if (!retry.error && retry.data.session) {
                setSession(retry.data.session);
                setUser(userFromSession(retry.data.session));
                saveLocalSession(null);
                closeAuthModal();
                return;
              }
            }
          } else {
            const { data } = await supabase.auth.getSession();
            if (data.session) {
              setSession(data.session);
              setUser(userFromSession(data.session));
              saveLocalSession(null);
              closeAuthModal();
              return;
            }
          }
        } catch (error) {
          logAuthDiagnostics("demoLogin supabase failed", {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      const demoUser = userFromDemo(account);
      saveLocalSession(demoUser);
      setUser(demoUser);
      setSession(null);
      closeAuthModal();
    },
    [closeAuthModal],
  );

  const signOut = useCallback(async () => {
    const supabase = getSupabase();
    if (supabase) await supabase.auth.signOut();
    saveLocalSession(null);
    setUser(null);
    setSession(null);
  }, []);

  const upgradeToPremium = useCallback(() => {
    if (!user) {
      openAuthModal("Sign in to upgrade to Pivoton Premium.");
      return;
    }
    saveSubscriptionStatus(user.id, "premium");
    setUser(withSubscription({ ...user, subscriptionStatus: "premium", isPremium: true }));
  }, [user, openAuthModal]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      isLoading,
      authModalOpen,
      authPrompt,
      openAuthModal,
      closeAuthModal,
      signIn,
      signUp,
      requestPasswordReset,
      updatePassword,
      demoLogin,
      signOut,
      upgradeToPremium,
    }),
    [
      user,
      session,
      isLoading,
      authModalOpen,
      authPrompt,
      openAuthModal,
      closeAuthModal,
      signIn,
      signUp,
      requestPasswordReset,
      updatePassword,
      demoLogin,
      signOut,
      upgradeToPremium,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export { DEMO_ACCOUNTS, isSupabaseConfigured };
