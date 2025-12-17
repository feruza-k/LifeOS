import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { api } from "@/lib/api";

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [token, setToken] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const { user, refreshUser } = useAuth();

  // Automatically verify if token is in URL
  useEffect(() => {
    const urlToken = searchParams.get("token");
    if (urlToken) {
      setToken(urlToken);
      handleVerifyToken(urlToken);
    }
  }, [searchParams]);

  const handleVerifyToken = async (tokenToVerify: string) => {
    if (!tokenToVerify.trim()) {
      return;
    }

    setIsLoading(true);
    try {
      await api.verifyEmail(tokenToVerify);
      toast.success("Email verified successfully!");
      setIsVerified(true);
      await refreshUser();
      // Redirect to home after a short delay
      setTimeout(() => {
        navigate("/");
      }, 2000);
    } catch (error: any) {
      const errorMessage = error?.message || "Verification failed. Please try again.";
      toast.error(errorMessage);
      // Clear token from URL on error
      navigate("/verify-email", { replace: true });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!token.trim()) {
      toast.error("Please enter the verification token");
      return;
    }

    await handleVerifyToken(token);
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

  // Show success message if verified
  if (isVerified) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm animate-fade-in text-center">
          <div className="mb-6">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-green-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
          </div>
          <h1 className="text-4xl font-serif font-medium text-foreground mb-2">
            Verification Successful!
          </h1>
          <p className="text-sm text-muted-foreground font-sans mb-6">
            Your email has been verified successfully. You can now use all features of LifeOS.
          </p>
          <p className="text-xs text-muted-foreground font-sans">
            Redirecting you to the app...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm animate-fade-in">
        {/* Branding */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-serif font-medium text-foreground mb-2">
            Verify Your Email
          </h1>
          <p className="text-sm text-muted-foreground font-sans">
            {searchParams.get("token")
              ? "Verifying your email..."
              : "Please enter the verification token sent to your email"}
          </p>
        </div>

        {/* Auto-verifying message */}
        {searchParams.get("token") && isLoading && (
          <div className="mb-6 p-4 bg-primary/10 rounded-lg border border-primary/20">
            <p className="text-sm text-foreground font-sans text-center">
              Verifying your email address...
            </p>
          </div>
        )}

        {/* Manual token entry (fallback) */}
        {!searchParams.get("token") && (
          <>
            {/* Info */}
            <div className="mb-6 p-4 bg-muted/50 rounded-lg border border-border/50">
              <p className="text-sm text-muted-foreground font-sans">
                <strong>Tip:</strong> Click the verification link in your email for automatic verification.
                Or manually enter the token below.
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
          </>
        )}

        {/* Resend */}
        {user?.email && (
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={handleResend}
              className="text-sm font-sans text-primary hover:text-primary/80 transition-colors"
              disabled={isLoading}
            >
              Resend verification email
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

