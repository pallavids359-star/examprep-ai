import { createContext, useContext, useEffect, useState } from "react";
import api from "../api/axios";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true); // true while we check a saved token

    // When the app opens: if a token was saved, ask the backend who it belongs to
    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) {
            setLoading(false);
            return;
        }
        api
            .get("/auth/me")
            .then((res) => setUser(res.data.user))
            .catch(() => localStorage.removeItem("token")) // expired or invalid token
            .finally(() => setLoading(false));
    }, []);

    // Save the token so the user stays logged in after refreshing
    const saveSession = (data) => {
        localStorage.setItem("token", data.token);
        setUser(data.user);
    };

    const login = async (email, password) => {
        const res = await api.post("/auth/login", { email, password });
        saveSession(res.data);
        return res.data.user;
    };

    const register = async (name, email, password, extra = {}) => {
        const res = await api.post("/auth/register", { name, email, password, ...extra });
        saveSession(res.data);
        return res.data.user;
    };

    const logout = () => {
        localStorage.removeItem("token");
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, setUser, loading, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

// Any page can call useAuth() to get the user, login, logout, etc.
export const useAuth = () => useContext(AuthContext);