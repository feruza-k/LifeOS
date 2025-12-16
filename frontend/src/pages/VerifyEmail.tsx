import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { api } from "@/lib/api";

export default function VerifyEmail() {
  const [token, setToken] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { user, refreshUser } = useAuth();

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!token.trim()) {
      toast.error("Please enter the verification token");
      return;
    }

    setIsLoading(true);
    try {
      await api.verifyEmail(token);
      toast.success("Email verified successfully!");
      await refreshUser();
      // Will redirect via ProtectedRoute
    } catch (error: any) {
      const errorMessage = error?.message || "Verification failed. Please try again.";
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (!user?.email) {
      toast.error("No email found");
      return;
    }

    setIsLoading(true);
    try {
      await api.resendVerification(user.email);
      toast.success("Verification email sent! Please check your inbox.");
    } catch (error: any) {
      const errorMessage = error?.message || "Failed to resend verification";
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm animate-fade-in">
        {/* Branding */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-serif font-medium text-foreground mb-2">
            Verify Your Email
          </h1>
          <p className="text-sm text-muted-foreground font-sans">
            Please enter the verification token sent to your email
          </p>
        </div>

        {/* Info */}
        <div className="mb-6 p-4 bg-muted/50 rounded-lg border border-border/50">
          <p className="text-sm text-muted-foreground font-sans">
            <strong>Note:</strong> For now, verification tokens are logged to the server console.
            Check your backend logs for the token.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleVerify} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="token" className="text-sm font-sans text-foreground">
              Verification Token
            </Label>
            <Input
              id="token"
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Enter verification token"
              className="h-12 bg-card border-border/50 focus:border-primary/50 font-mono"
              disabled={isLoading}
            />
          </div>

          <Button
            type="submit"
            className="w-full h-12 text-base font-sans font-medium"
            disabled={isLoading}
          >
            {isLoading ? "Verifying..." : "Verify Email"}
          </Button>
        </form>

        {/* Resend */}
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={handleResend}
            className="text-sm font-sans text-primary hover:text-primary/80 transition-colors"
            disabled={isLoading}
          >
            Resend verification token
          </button>
        </div>
      </div>
    </div>
  );
}

