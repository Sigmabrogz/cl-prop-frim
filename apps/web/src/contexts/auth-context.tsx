"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { authApi, api, type User } from "@/lib/api";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (data: { email: string; username: string; password: string }) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const refreshUser = useCallback(async () => {
    try {
      // With httpOnly cookies, we just make the request and the cookie is sent automatically
      const response = await authApi.me();
      if (response.success && response.data?.user) {
        setUser(response.data.user);
        // Store the WebSocket token if returned (for reconnection after page refresh)
        if (response.data.token) {
          api.setWsToken(response.data.token);
        }
      } else {
        // Clear WebSocket token on auth failure
        api.clearWsToken();
        setUser(null);
      }
    } catch {
      api.clearWsToken();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await authApi.login(email, password);
      console.log("[Auth] Login response:", response);
      if (response.success && response.data) {
        // API returns token directly in data
        const data = response.data as { token: string; user: User };
        // Store token in sessionStorage for WebSocket authentication only
        api.setWsToken(data.token);
        setUser(data.user);
        return { success: true };
      }
      // Ensure error is always a string
      const errorMessage = typeof response.error === 'string' 
        ? response.error 
        : typeof response.error === 'object' && response.error !== null
          ? JSON.stringify(response.error)
          : "Login failed";
      return { success: false, error: errorMessage };
    } catch (error) {
      console.error("[Auth] Login error:", error);
      return { success: false, error: "An error occurred" };
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (data: { email: string; username: string; password: string }) => {
    setIsLoading(true);
    try {
      const response = await authApi.signup(data);
      if (response.success && response.data) {
        // Store token in sessionStorage for WebSocket authentication only
        api.setWsToken(response.data.token);
        setUser(response.data.user);
        return { success: true };
      }
      return { success: false, error: response.error || "Signup failed" };
    } catch (error) {
      return { success: false, error: "An error occurred" };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore logout errors
    } finally {
      // Clear WebSocket token
      api.clearWsToken();
      setUser(null);
      router.push("/login");
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        signup,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

// Higher-order component for protected routes
export function withAuth<P extends object>(
  Component: React.ComponentType<P>
): React.FC<P> {
  return function ProtectedRoute(props: P) {
    const { isAuthenticated, isLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
      if (!isLoading && !isAuthenticated) {
        router.push("/login");
      }
    }, [isLoading, isAuthenticated, router]);

    if (isLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      );
    }

    if (!isAuthenticated) {
      return null;
    }

    return <Component {...props} />;
  };
}

