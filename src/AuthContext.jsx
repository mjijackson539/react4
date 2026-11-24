import { createContext, useContext, useEffect, useState } from "react";
import { request, send } from "./api";
export const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null),
    [loading, setLoading] = useState(!!sessionStorage.getItem("token")),
    [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    const expire = () => {
      setUser(null);
      setLoading(false);
    };
    window.addEventListener("session-expired", expire);
    if (sessionStorage.getItem("token"))
      request("/me")
        .then((u) => {
          if (live) setUser(u);
        })
        .catch((e) => {
          if (live) setError(e.message);
        })
        .finally(() => {
          if (live) setLoading(false);
        });
    return () => {
      live = false;
      window.removeEventListener("session-expired", expire);
    };
  }, []);
  function authenticate(data) {
    sessionStorage.setItem("token", data.token);
    setUser(data.user);
    setError("");
  }
  async function logout() {
    await send("/logout", "POST");
    sessionStorage.removeItem("token");
    setUser(null);
  }
  return (
    <AuthContext.Provider
      value={{ user, setUser, loading, error, authenticate, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}
