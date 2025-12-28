import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { validatePassword, getPasswordRequirements } from "@/lib/passwordValidator";
import { api } from "@/lib/api";

// Hardcoded API base URL for login form (Safari requires genuine form submission)
// This eliminates any ambiguity from environment variables
const API_BASE = "https://api.mylifeos.dev";

type AuthMode = "login" | "signup" | "forgot-password" | "reset-password";

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);
  
  // Initialize state from URL params immediately to avoid showing error on first render
  const urlMode = searchParams.get("mode");
  const urlToken = searchParams.get("token");
  const initialMode = (urlMode === "reset-password" && urlToken) ? "reset-password" : "login";
  const initialToken = urlMode === "reset-password" && urlToken ? urlToken : "";
  
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [username, setUsername] = useState("");
  const [resetToken, setResetToken] = useState(initialToken);
  const [isLoading, setIsLoading] = useState(false);
  const { login, signup, refreshUser } = useAuth();

  const passwordValidation = mode === "signup" || mode === "reset-password" 
    ? validatePassword(password) 
    : { isValid: true, errors: [] };

  // Check for base tag that could cause path rewriting
  // Also verify the login form is properly configured for native submission
  useEffect(() => {
    // Check for base tag that could cause path rewriting
    const baseTag = document.querySelector("base");
    if (baseTag) {
      console.error("[Auth] ⚠️ BASE TAG DETECTED - This will break form actions!", baseTag.href);
      // Remove base tag if found (it shouldn't exist)
      baseTag.remove();
    }

    // Verify login form is configured correctly for native submission
    if (formRef.current && mode === "login") {
      const form = formRef.current;
      // Log for debugging - verify form is real and has correct attributes
      console.log("[Auth] Login form detected in DOM:", {
        action: form.action,
        method: form.method,
        hasOnSubmit: !!form.onsubmit,
        formElement: form.tagName,
      });
      
      // Double-check action is set correctly (safety measure)
      if (form.action !== "https://api.mylifeos.dev/auth/login") {
        console.warn("[Auth] Form action mismatch! Setting to correct URL.");
        form.action = "https://api.mylifeos.dev/auth/login";
      }
      
      // Ensure method is POST
      if (form.method.toLowerCase() !== "post") {
        console.warn("[Auth] Form method mismatch! Setting to POST.");
        form.method = "POST";
      }
    }
  }, [mode]);

  // Update state when URL params change
  useEffect(() => {
    const urlMode = searchParams.get("mode");
    const urlToken = searchParams.get("token");
    const loginSuccess = searchParams.get("login");
    const signupSuccess = searchParams.get("signup");
    const error = searchParams.get("error");

    // Handle login errors from form submission
    if (error === "locked") {
      toast.error("Account temporarily locked due to too many failed login attempts. Please try again later.");
      navigate("/auth", { replace: true });
      setIsLoading(false);
    } else if (error === "invalid") {
      toast.error("Incorrect email or password");
      navigate("/auth", { replace: true });
      setIsLoading(false);
    } else if (error === "mismatch") {
      toast.error("Passwords do not match");
      setMode("signup");
      navigate("/auth?mode=signup", { replace: true });
    } else if (error === "weak_password") {
      toast.error("Password is too weak. Please check requirements.");
      setMode("signup");
      navigate("/auth?mode=signup", { replace: true });
    } else if (error === "exists") {
      toast.error("Email already registered. Please log in.");
      setMode("login");
      navigate("/auth", { replace: true });
    }

    // Handle login success redirect (from form submission)
    if (loginSuccess === "success") {
      // Remove the query param from URL
      navigate("/", { replace: true });
      // Refresh user data to get the authenticated user
      refreshUser().then(() => {
        toast.success("Welcome back!");
      }).catch(() => {
        // If refresh fails, user might need to log in again
        toast.error("Login successful, but could not load user data. Please refresh the page.");
      });
      return;
    }

    if (urlMode === "reset-password" && urlToken) {
      setMode("reset-password");
      setResetToken(urlToken);
    } else if (urlMode !== "reset-password") {
      // If mode changes away from reset-password, reset token
      setResetToken("");
    }
  }, [searchParams, navigate, refreshUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === "forgot-password") {
      if (!email.trim()) {
        toast.error("Please enter your email");
        return;
      }
      setIsLoading(true);
      try {
        await api.forgotPassword(email);
        toast.success("If the email exists, a password reset email has been sent. Please check your inbox.");
        // Don't switch to reset-password mode - user needs to click link in email
        // Clear form
        setEmail("");
      } catch (error: any) {
        toast.error(error?.message || "Failed to send reset token");
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (mode === "reset-password") {
      // Token should come from URL - validate it's present
      if (!resetToken.trim()) {
        toast.error("Invalid reset link. Please request a new password reset.");
        return;
      }
      if (!password.trim() || !confirmPassword.trim()) {
        toast.error("Please fill in all fields");
        return;
      }
      if (password !== confirmPassword) {
        toast.error("Passwords do not match");
        return;
      }
      if (!passwordValidation.isValid) {
        toast.error(passwordValidation.errors[0]);
        return;
      }
      setIsLoading(true);
      try {
        await api.resetPassword(resetToken, password, confirmPassword);
        toast.success("Password reset successfully! Please log in.");
        setMode("login");
        setPassword("");
        setConfirmPassword("");
        setResetToken("");
        // Clear URL params
        navigate("/auth", { replace: true });
      } catch (error: any) {
        const errorMessage = error?.message || "Password reset failed";
        toast.error(errorMessage);
        // If token is invalid, clear it and reset mode
        if (errorMessage.includes("Invalid") || errorMessage.includes("expired")) {
          setResetToken("");
          navigate("/auth", { replace: true });
        }
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (mode === "signup") {
      if (!email.trim() || !password.trim() || !confirmPassword.trim()) {
        toast.error("Please fill in all fields");
        return;
      }
      if (password !== confirmPassword) {
        toast.error("Passwords do not match");
        return;
      }
      if (!passwordValidation.isValid) {
        toast.error(passwordValidation.errors[0]);
        return;
      }
      setIsLoading(true);
      try {
        await signup(email, password, confirmPassword, username || undefined);
        toast.success("Account created! Please check your email to verify your account.");
        // Navigate to verify-email page
        navigate("/verify-email", { replace: true });
      } catch (error: any) {
        const errorMessage = error?.message || "Something went wrong. Please try again.";
        try {
          const errorJson = JSON.parse(errorMessage);
          toast.error(errorJson.detail || errorMessage);
        } catch {
          toast.error(errorMessage);
        }
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // Login mode - form submission is handled by the real HTML form
    // No JavaScript intervention needed - Safari requires genuine form submission
    // The form will submit naturally to the backend, which will redirect with cookies
    // No code needed here - the form submits directly to the backend
  };

  const toggleMode = () => {
    if (mode === "login") {
      setMode("signup");
    } else if (mode === "signup") {
      setMode("login");
    } else {
      setMode("login");
    }
    setPassword("");
    setConfirmPassword("");
    setUsername("");
    setResetToken("");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm animate-fade-in">
        {/* Branding */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-serif font-medium text-foreground mb-2">
            LifeOS
          </h1>
          <p className="text-sm text-muted-foreground font-sans">
            {mode === "forgot-password" || mode === "reset-password"
              ? "Reset your password"
              : mode === "signup"
              ? "Create your account"
              : "Your personal operating system"}
          </p>
        </div>

        {/* Form */}
        {/* CRITICAL: For login mode, use a REAL native HTML form with NO JavaScript handlers */}
        {/* Safari requires genuine form submission - no onSubmit, no preventDefault */}
        {mode === "login" ? (
          <form 
            ref={formRef}
            method="POST"
            action="https://api.mylifeos.dev/auth/login"
            className="space-y-5"
          >
            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm font-sans text-foreground">
                Email
              </Label>
              <Input
                id="username"
                name="username"
                type="email"
                defaultValue={email}
                placeholder="you@example.com"
                className="h-12 bg-card border-border/50 focus:border-primary/50"
                disabled={isLoading}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-sans text-foreground">
                Password
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                defaultValue={password}
                placeholder="••••••••"
                className="h-12 bg-card border-border/50 focus:border-primary/50"
                disabled={isLoading}
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-base font-sans font-medium"
              disabled={isLoading}
            >
              {isLoading ? "Please wait..." : "Continue"}
            </Button>
          </form>
        ) : mode === "signup" ? (
          <form 
            method="POST"
            action="https://api.mylifeos.dev/auth/signup-form"
            className="space-y-5"
          >
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-sans text-foreground">
                Email
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                className="h-12 bg-card border-border/50 focus:border-primary/50"
                disabled={isLoading}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm font-sans text-foreground">
                Username
              </Label>
              <Input
                id="username"
                name="username"
                type="text"
                placeholder="username"
                className="h-12 bg-card border-border/50 focus:border-primary/50"
                disabled={isLoading}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-sans text-foreground">
                Password
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                className="h-12 bg-card border-border/50 focus:border-primary/50"
                disabled={isLoading}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm_password" className="text-sm font-sans text-foreground">
                Confirm Password
              </Label>
              <Input
                id="confirm_password"
                name="confirm_password"
                type="password"
                placeholder="••••••••"
                className="h-12 bg-card border-border/50 focus:border-primary/50"
                disabled={isLoading}
                required
              />
            </div>

            {/* Password requirements */}
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-medium">Password requirements:</p>
              <ul className="list-disc list-inside space-y-0.5">
                {getPasswordRequirements().map((req, i) => (
                  <li key={i}>{req}</li>
                ))}
              </ul>
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-base font-sans font-medium"
              disabled={isLoading}
            >
              {isLoading ? "Please wait..." : "Create account"}
            </Button>
          </form>
        ) : (
          <form 
            onSubmit={handleSubmit}
            className="space-y-5"
          >
          {mode === "forgot-password" && (
            <>
              <div className="mb-6 p-4 bg-primary/10 rounded-lg border border-primary/20">
                <p className="text-sm text-foreground font-sans">
                  Enter your email address and we'll send you a link to reset your password.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-sans text-foreground">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="h-12 bg-card border-border/50 focus:border-primary/50"
                  disabled={isLoading}
                />
              </div>
            </>
          )}

          {mode === "signup" && (
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-sans text-foreground">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="h-12 bg-card border-border/50 focus:border-primary/50"
                disabled={isLoading}
              />
            </div>
          )}
          
          {mode === "reset-password" && !resetToken && (
            <div className="mb-6 p-4 bg-destructive/10 rounded-lg border border-destructive/20">
              <p className="text-sm text-destructive font-sans mb-3">
                Invalid or missing reset link.
              </p>
              <button
                type="button"
                onClick={() => setMode("forgot-password")}
                className="text-sm font-sans text-primary hover:text-primary/80 transition-colors underline"
              >
                Request a new password reset
              </button>
            </div>
          )}
          
          {mode === "reset-password" && resetToken && (
            <div className="mb-6 p-4 bg-primary/10 rounded-lg border border-primary/20">
              <p className="text-sm text-foreground font-sans">
                Enter your new password below.
              </p>
            </div>
          )}

          {mode === "signup" && (
            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm font-sans text-foreground">
                Username
              </Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username"
                className="h-12 bg-card border-border/50 focus:border-primary/50"
                disabled={isLoading}
                required
              />
            </div>
          )}

          {(mode === "signup" || mode === "reset-password") && (
            <>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-sans text-foreground">
                  {mode === "reset-password" ? "New Password" : "Password"}
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`h-12 bg-card border-border/50 focus:border-primary/50 ${
                    password && !passwordValidation.isValid ? "border-destructive" : ""
                  }`}
                  disabled={isLoading}
                />
                {password && !passwordValidation.isValid && (
                  <div className="text-xs text-destructive mt-1 space-y-1">
                    {passwordValidation.errors.map((err, i) => (
                      <div key={i}>• {err}</div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="text-sm font-sans text-foreground">
                  {mode === "reset-password" ? "Confirm New Password" : "Confirm Password"}
                </Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`h-12 bg-card border-border/50 focus:border-primary/50 ${
                    confirmPassword && password !== confirmPassword ? "border-destructive" : ""
                  }`}
                  disabled={isLoading}
                />
                {confirmPassword && password !== confirmPassword && (
                  <p className="text-xs text-destructive mt-1">Passwords do not match</p>
                )}
              </div>

              {/* Password requirements */}
              <div className="text-xs text-muted-foreground space-y-1">
                <p className="font-medium">Password requirements:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  {getPasswordRequirements().map((req, i) => (
                    <li key={i}>{req}</li>
                  ))}
                </ul>
              </div>
            </>
          )}


          <Button
            type="submit"
            className="w-full h-12 text-base font-sans font-medium"
            disabled={isLoading || (mode === "reset-password" && !resetToken)}
          >
            {isLoading
              ? "Please wait..."
              : mode === "forgot-password"
              ? "Send Reset Link"
              : mode === "reset-password"
              ? "Reset Password"
              : mode === "signup"
              ? "Create account"
              : "Continue"}
          </Button>
          </form>
        )}

        {/* Mode toggle */}
        <div className="mt-6 text-center space-y-2">
          {mode === "login" && (
            <>
              <button
                type="button"
                onClick={toggleMode}
                className="text-sm font-sans text-primary hover:text-primary/80 transition-colors"
                disabled={isLoading}
              >
                Create account
              </button>
              <div>
                <button
                  type="button"
                  onClick={() => setMode("forgot-password")}
                  className="text-xs font-sans text-muted-foreground hover:text-foreground transition-colors"
                  disabled={isLoading}
                >
                  Forgot password?
                </button>
              </div>
            </>
          )}
          {mode === "signup" && (
            <button
              type="button"
              onClick={toggleMode}
              className="text-sm font-sans text-primary hover:text-primary/80 transition-colors"
              disabled={isLoading}
            >
              Back to login
            </button>
          )}
          {(mode === "forgot-password" || mode === "reset-password") && (
            <button
              type="button"
              onClick={() => setMode("login")}
              className="text-sm font-sans text-primary hover:text-primary/80 transition-colors"
              disabled={isLoading}
            >
              Back to login
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
