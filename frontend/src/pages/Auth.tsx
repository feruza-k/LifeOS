import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type AuthMode = "login" | "signup";

export default function Auth() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login, signup } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim() || !password.trim()) {
      toast.error("Please fill in all fields");
      return;
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setIsLoading(true);
    try {
      if (mode === "login") {
        await login(email, password);
        toast.success("Welcome back!");
      } else {
        await signup(email, password);
        toast.success("Account created successfully!");
      }
      navigate("/");
    } catch (error) {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setMode(mode === "login" ? "signup" : "login");
    setEmail("");
    setPassword("");
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
            Your personal operating system
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
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

          <Button
            type="submit"
            className="w-full h-12 text-base font-sans font-medium"
            disabled={isLoading}
          >
            {isLoading
              ? "Please wait..."
              : mode === "login"
              ? "Continue"
              : "Create account"}
          </Button>
        </form>

        {/* Mode toggle */}
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={toggleMode}
            className="text-sm font-sans text-primary hover:text-primary/80 transition-colors"
            disabled={isLoading}
          >
            {mode === "login" ? "Create account" : "Back to login"}
          </button>
        </div>

        {/* Forgot password (login only) */}
        {mode === "login" && (
          <div className="mt-4 text-center">
            <button
              type="button"
              className="text-xs font-sans text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => toast.info("Password reset coming soon")}
            >
              Forgot password?
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
