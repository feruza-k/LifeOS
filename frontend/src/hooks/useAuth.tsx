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
  logout: () => void;
  loading: boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Check for existing token on mount
  useEffect(() => {
    const token = localStorage.getItem("lifeos-token");
    if (token) {
      api.setAuthToken(token);
      // Verify token and get user info
      api.getCurrentUser()
        .then((userData: User) => {
          setUser(userData);
          setIsAuthenticated(true);
        })
        .catch(() => {
          // Token invalid, clear it
          localStorage.removeItem("lifeos-token");
          api.setAuthToken(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const response = await api.login(email, password);
    localStorage.setItem("lifeos-token", response.access_token);
    api.setAuthToken(response.access_token);
    
    const userData = await api.getCurrentUser();
    setUser(userData);
    setIsAuthenticated(true);
  }, []);

  const signup = useCallback(async (email: string, password: string, confirmPassword: string, username?: string) => {
    const response = await api.signup(email, password, confirmPassword, username);
    localStorage.setItem("lifeos-token", response.access_token);
    api.setAuthToken(response.access_token);
    
    const userData = await api.getCurrentUser();
    setUser(userData);
    setIsAuthenticated(true);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const userData = await api.getCurrentUser();
      setUser(userData);
    } catch (error) {
      console.error("Failed to refresh user:", error);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("lifeos-token");
    api.setAuthToken(null);
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