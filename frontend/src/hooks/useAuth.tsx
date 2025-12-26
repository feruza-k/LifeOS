import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from "react";
import { api } from "@/lib/api";

interface User {
  id: string;
  email: string;
  created_at: string;
  username?: string;
  email_verified: boolean;
  avatar_path?: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, confirmPassword: string, username?: string) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Check for existing session on mount (tokens in httpOnly cookies)
  useEffect(() => {
    let cancelled = false;
    
    // Add timeout to prevent hanging on mobile if backend is unreachable
    const timeoutId = setTimeout(() => {
      if (!cancelled) {
        console.warn("Auth check timeout - backend may be unreachable");
        setLoading(false);
        setUser(null);
        setIsAuthenticated(false);
      }
    }, 10000); // 10 second timeout

    api.getCurrentUser()
      .then((userData: User) => {
        if (!cancelled) {
          clearTimeout(timeoutId);
          setUser(userData);
          setIsAuthenticated(true);
          setLoading(false);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          clearTimeout(timeoutId);
          // No valid session - this is expected if user is not logged in
          console.log("No valid session:", error);
          setUser(null);
          setIsAuthenticated(false);
          setLoading(false);
        }
      });
    
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    await api.login(email, password);
    // Tokens are now in httpOnly cookies, get user info
    // Wait a bit for cookies to be set
    await new Promise(resolve => setTimeout(resolve, 100));
    const userData = await api.getCurrentUser();
    setUser(userData);
    setIsAuthenticated(true);
  }, []);

  const signup = useCallback(async (email: string, password: string, confirmPassword: string, username?: string) => {
    await api.signup(email, password, confirmPassword, username);
    // Tokens are now in httpOnly cookies, try to get user info
    // If this fails, user can still verify email and log in
    try {
      const userData = await api.getCurrentUser();
      setUser(userData);
      setIsAuthenticated(true);
    } catch (error) {
      // If getCurrentUser fails, that's okay - user can verify email and log in
      // The signup was successful, tokens are in cookies
      console.log("Could not fetch user after signup, but signup was successful:", error);
      // Don't throw - signup was successful, user just needs to verify email
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const userData = await api.getCurrentUser();
      setUser(userData);
    } catch (error) {
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch (error) {
    }
    // Clear local state regardless of API call result
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, signup, logout, loading, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}