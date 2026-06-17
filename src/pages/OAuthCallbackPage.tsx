import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { api } from "../api/client";
import { raiseAppError } from "@/common/errors/raiseAppError";
import { AxiosError } from "axios";
import axios from "axios";

const KRATOS_BROWSER_URL = import.meta.env.VITE_KRATOS_BROWSER_URL;

interface KratosSession {
    identity: {
        id: string;
    };
}

export default function OAuthCallbackPage() {
    const navigate = useNavigate();
    const { login } = useAuth();

    useEffect(() => {
        const run = async () => {
            try {
                const sessionRes = await axios.get<KratosSession>(
                    `${KRATOS_BROWSER_URL}/sessions/whoami`,
                    {
                        withCredentials: true,
                    }
                );

                const kratosID = sessionRes.data.identity.id;

                let deviceId = localStorage.getItem("device_id");

                if (!deviceId) {
                    deviceId = crypto.randomUUID();
                    localStorage.setItem("device_id", deviceId);
                }

                await api.post("/bff/login", {
                    user_id: kratosID,
                    device_id: deviceId,
                    remember_me: false,
                });

                login();

                navigate("/accounts", {
                    replace: true,
                });
            } catch (err: unknown) {
                if (err instanceof AxiosError) {
                    raiseAppError(
                        "UNAUTHORIZED",
                        navigate,
                        err.response?.data?.message
                    );
                } else {
                    raiseAppError(
                        "UNAUTHORIZED",
                        navigate,
                        "Unexpected authentication error"
                    );
                }
            }
        };

        run();
    }, [navigate, login]);

    return (
        <div className="text-center p-10">
            Logging in with Google...
        </div>
    );
}