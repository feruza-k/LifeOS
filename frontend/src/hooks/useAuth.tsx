import { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface AuthContextType {
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem("lifeos-authenticated") === "true";
  });

  const login = useCallback(async (email: string, password: string) => {
    // Mock login - in future, replace with real auth
    await new Promise((resolve) => setTimeout(resolve, 500));
    localStorage.setItem("lifeos-authenticated", "true");
    setIsAuthenticated(true);
  }, []);

  const signup = useCallback(async (email: string, password: string) => {
    // Mock signup - in future, replace with real auth
    await new Promise((resolve) => setTimeout(resolve, 500));
    localStorage.setItem("lifeos-authenticated", "true");
    setIsAuthenticated(true);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("lifeos-authenticated");
    setIsAuthenticated(false);
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, signup, logout }}>
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