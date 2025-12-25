import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { validatePassword, getPasswordRequirements } from "@/lib/passwordValidator";
import { api } from "@/lib/api";

type AuthMode = "login" | "signup" | "forgot-password" | "reset-password";

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
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

  // Update state when URL params change
  useEffect(() => {
    const urlMode = searchParams.get("mode");
    const urlToken = searchParams.get("token");

    if (urlMode === "reset-password" && urlToken) {
      setMode("reset-password");
      setResetToken(urlToken);
    } else if (urlMode !== "reset-password") {
      // If mode changes away from reset-password, reset token
      setResetToken("");
    }
  }, [searchParams]);

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

    // Login mode
    if (!email.trim() || !password.trim()) {
      toast.error("Please fill in all fields");
      return;
    }

    setIsLoading(true);
    try {
      await login(email, password);
      toast.success("Welcome back!");
      navigate("/");
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
        <form onSubmit={handleSubmit} className="space-y-5">
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


          {mode === "login" && (
            <>
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

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-sans text-foreground">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-12 bg-card border-border/50 focus:border-primary/50"
                  disabled={isLoading}
                />
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
