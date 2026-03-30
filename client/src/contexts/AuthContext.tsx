import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { api } from "../api";

interface User {
  id: number;
  username: string;
  role: "admin" | "staff";
  displayName: string;
}

interface AuthContextType {
  token: string | null;
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

function parseJwt(token: string): any {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

function getUserFromToken(token: string | null): User | null {
  if (!token) return null;
  const payload = parseJwt(token);
  if (!payload) return null;
  // Check expiry
  if (payload.exp && payload.exp * 1000 < Date.now()) return null;
  return {
    id: payload.userId,
    username: payload.username,
    role: payload.role,
    displayName: payload.displayName,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(
    localStorage.getItem("token")
  );
  const [user, setUser] = useState<User | null>(() =>
    getUserFromToken(localStorage.getItem("token"))
  );

  useEffect(() => {
    if (token) {
      localStorage.setItem("token", token);
      setUser(getUserFromToken(token));
    } else {
      localStorage.removeItem("token");
      setUser(null);
    }
  }, [token]);

  const login = async (username: string, password: string) => {
    const res = await api.post<{ token: string; user: User }>("/api/auth/login", {
      username,
      password,
    });
    setToken(res.token);
  };

  const logout = () => {
    setToken(null);
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        login,
        logout,
        isAuthenticated: !!token && !!user,
        isAdmin: user?.role === "admin",
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
