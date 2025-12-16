import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { validatePassword, getPasswordRequirements } from "@/lib/passwordValidator";
import { api } from "@/lib/api";

type AuthMode = "login" | "signup" | "forgot-password" | "reset-password";

export default function Auth() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [username, setUsername] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login, signup, refreshUser } = useAuth();
  const navigate = useNavigate();

  const passwordValidation = mode === "signup" || mode === "reset-password" 
    ? validatePassword(password) 
    : { isValid: true, errors: [] };

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
        toast.success("If the email exists, a password reset email has been sent.");
        setMode("reset-password");
      } catch (error: any) {
        toast.error(error?.message || "Failed to send reset token");
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (mode === "reset-password") {
      if (!resetToken.trim() || !password.trim() || !confirmPassword.trim()) {
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
      } catch (error: any) {
        const errorMessage = error?.message || "Password reset failed";
        toast.error(errorMessage);
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
        toast.success("Account created! Please verify your email.");
        await refreshUser();
        // Will redirect to verify-email via ProtectedRoute
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
          {(mode === "signup" || mode === "forgot-password" || mode === "reset-password") && (
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

          {mode === "signup" && (
            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm font-sans text-foreground">
                Username <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username"
                className="h-12 bg-card border-border/50 focus:border-primary/50"
                disabled={isLoading}
              />
            </div>
          )}

          {(mode === "signup" || mode === "reset-password") && (
            <>
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
                  Confirm Password
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

          {mode === "reset-password" && (
            <div className="space-y-2">
              <Label htmlFor="reset-token" className="text-sm font-sans text-foreground">
                Reset Token
              </Label>
              <Input
                id="reset-token"
                type="text"
                value={resetToken}
                onChange={(e) => setResetToken(e.target.value)}
                placeholder="Enter reset token from email"
                className="h-12 bg-card border-border/50 focus:border-primary/50 font-mono"
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                Check server logs for the reset token
              </p>
            </div>
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
            disabled={isLoading}
          >
            {isLoading
              ? "Please wait..."
              : mode === "forgot-password"
              ? "Send Reset Token"
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
