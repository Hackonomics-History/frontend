import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { AuthContext } from "./AuthContext";
import { api } from "@/api/client";

export function AuthProvider({ children }: { children: ReactNode }) {
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const bootstrap = async () => {
            try {
                await api.get("/bff/whoami", { withCredentials: true });
                setAccessToken("authenticated");
            } catch {
                setAccessToken(null);
            } finally {
                setLoading(false);
            }
        };

        bootstrap();
    }, []);

    const login = useCallback(() => {
        setAccessToken("authenticated");
    }, []);

    const logout = useCallback(() => {
        setAccessToken(null);
    }, []);

    return (
        <AuthContext.Provider
            value={{
                accessToken,
                isAuthenticated: !!accessToken,
                loading,
                login,
                logout,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}
