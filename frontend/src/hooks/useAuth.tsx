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
    api.getCurrentUser()
      .then((userData: User) => {
        setUser(userData);
        setIsAuthenticated(true);
      })
      .catch((error) => {
        // No valid session - this is expected if user is not logged in
        setUser(null);
        setIsAuthenticated(false);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    await api.login(email, password);
    // Tokens are now in httpOnly cookies, get user info
    const userData = await api.getCurrentUser();
    setUser(userData);
    setIsAuthenticated(true);
  }, []);

  const signup = useCallback(async (email: string, password: string, confirmPassword: string, username?: string) => {
    await api.signup(email, password, confirmPassword, username);
    // Tokens are now in httpOnly cookies, get user info
    const userData = await api.getCurrentUser();
    setUser(userData);
    setIsAuthenticated(true);
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