import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { api } from "@/lib/api";

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [token, setToken] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const { user, refreshUser, isAuthenticated } = useAuth();

  // Automatically verify if token is in URL
  useEffect(() => {
    const urlToken = searchParams.get("token");
    if (urlToken && !isLoading && !isVerified) {
      setToken(urlToken);
      handleVerifyToken(urlToken);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      
      // Only refresh user if already authenticated (has valid session)
      // Otherwise, redirect to login since they need to authenticate first
      if (isAuthenticated && user) {
        try {
          await refreshUser();
        } catch {
          // If refresh fails, user needs to log in again
        }
      }
      
      // Redirect to auth page after user has time to see success message
      // User can then log in with their verified email
      setTimeout(() => {
        navigate("/auth");
      }, 8000);
    } catch (error: any) {
      const errorMessage = error?.message || "Verification failed. Please try again.";
      toast.error(errorMessage);
      // Clear token from URL on error
      navigate("/verify-email", { replace: true });
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

  // Show success message if verified
  if (isVerified) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-md animate-fade-in text-center">
          <div className="mb-8">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg
                className="w-10 h-10 text-primary"
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
          <h1 className="text-3xl font-serif font-medium text-foreground mb-3">
            Email Verified
          </h1>
          <p className="text-sm text-muted-foreground font-sans mb-8 leading-relaxed">
            Your email address has been successfully verified. You now have full access to all LifeOS features.
          </p>
          <Button
            onClick={() => navigate("/auth")}
            className="w-full h-12 text-base font-sans font-medium"
          >
            Continue to Login
          </Button>
          <p className="text-xs text-muted-foreground font-sans mt-4">
            Redirecting automatically in a few seconds...
          </p>
        </div>
      </div>
    );
  }

  // Show auto-verifying state if token is in URL
  if (searchParams.get("token") && isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-md animate-fade-in text-center">
          <div className="mb-8">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          </div>
          <h1 className="text-3xl font-serif font-medium text-foreground mb-3">
            Verifying Your Email
          </h1>
          <p className="text-sm text-muted-foreground font-sans">
            Please wait while we verify your email address...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-md animate-fade-in text-center">
        {/* Branding */}
        <div className="mb-10">
          <h1 className="text-3xl font-serif font-medium text-foreground mb-3">
            Verify Your Email
          </h1>
          <p className="text-sm text-muted-foreground font-sans leading-relaxed">
            We've sent a verification link to <strong>{user?.email || "your email"}</strong>. 
            Please check your inbox and click the link to verify your email address.
          </p>
        </div>

        {/* Info box */}
        <div className="mb-8 p-5 bg-primary/10 rounded-lg border border-primary/20">
          <p className="text-sm text-foreground font-sans mb-4">
            Click the verification link in your email to activate your account and access all LifeOS features.
          </p>
          {user?.email && (
            <button
              type="button"
              onClick={handleResend}
              className="text-sm font-sans text-primary hover:text-primary/80 transition-colors underline"
              disabled={isLoading}
            >
              Didn't receive the email? Resend verification
            </button>
          )}
        </div>

        {/* Back to login option */}
        <div className="mt-6">
          <button
            type="button"
            onClick={() => navigate("/auth")}
            className="text-sm font-sans text-muted-foreground hover:text-foreground transition-colors"
          >
            Back to login
          </button>
        </div>
      </div>
    </div>
  );
}

