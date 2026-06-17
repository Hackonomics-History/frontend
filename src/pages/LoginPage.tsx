import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios, { AxiosError } from "axios";
import { api } from "../api/client";
import { useAuth } from "../auth/useAuth";
import { Lock, Mail, Eye, EyeOff, AlertCircle } from "lucide-react";
import { raiseAppError } from "@/common/errors/raiseAppError";

import AuthLayout from "../components/layouts/AuthLayout";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";

const KRATOS_BROWSER_URL = import.meta.env.VITE_KRATOS_BROWSER_URL;

interface KratosUiNode {
    attributes: {
        name?: string;
        value?: string;
    };
}

interface KratosLoginFlow {
    ui: {
        action: string;
        nodes: KratosUiNode[];
    };
}

interface KratosSession {
    identity: {
        id: string;
    };
}

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [rememberMe, setRememberMe] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);

    const { login } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        const checkSession = async () => {
            try {
                const sessionRes = await axios.get<KratosSession>(
                    `${KRATOS_BROWSER_URL}/sessions/whoami`,
                    {
                        withCredentials: true,
                    }
                );

                // 이미 Kratos 세션이 있으면
                // BFF 세션도 보장하고 Account 화면으로 이동
                await api.post("/bff/login", {
                    user_id: sessionRes.data.identity.id,
                    device_id: getDeviceId(),
                    remember_me: false,
                });

                login();

                navigate("/accounts", {
                    replace: true,
                });
            } catch {
                // 로그인 안 된 상태
                // 그냥 로그인 화면 유지
            }
        };

        checkSession();
    }, [navigate, login]);

    const getDeviceId = () => {
        let id = localStorage.getItem("device_id");
        if (!id) {
            id = crypto.randomUUID();
            localStorage.setItem("device_id", id);
        }
        return id;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // Step 1: Initialize Kratos login flow (browser mode + SPA JSON response)
            const flowRes = await axios.get<KratosLoginFlow>(
                `${KRATOS_BROWSER_URL}/self-service/login/browser`,
                {
                    headers: { Accept: "application/json" },
                    withCredentials: true,
                }
            );
            const csrfToken =
                flowRes.data.ui.nodes.find((n) => n.attributes?.name === "csrf_token")
                    ?.attributes?.value ?? "";

            // Step 2: Submit password credentials to Kratos
            // On success Kratos sets ory_kratos_session cookie and returns 200.
            await axios.post(
                flowRes.data.ui.action,
                { method: "password", identifier: email, password, csrf_token: csrfToken },
                {
                    headers: { "Content-Type": "application/json", Accept: "application/json" },
                    withCredentials: true,
                }
            );

            // Step 3: Get Kratos identity ID from the session cookie
            const sessionRes = await axios.get<KratosSession>(
                `${KRATOS_BROWSER_URL}/sessions/whoami`,
                { withCredentials: true }
            );

            // Step 4: Exchange Kratos session for an opaque BFF __session cookie
            await api.post("/bff/login", {
                user_id: sessionRes.data.identity.id,
                device_id: getDeviceId(),
                remember_me: rememberMe,
            });

            login();

            navigate("/accounts", {
                replace: true,
            });
        } catch (err: unknown) {
            if (err instanceof AxiosError) {
                if (err.response?.status === 400) {
                    const msg =
                        err.response.data?.ui?.messages?.[0]?.text ??
                        "Invalid email or password.";
                    setError(msg);
                } else {
                    const appError = raiseAppError(
                        err.response?.data?.code ?? "UNKNOWN_ERROR",
                        navigate,
                        err.response?.data?.message
                    );
                    setError(appError.message);
                }
            } else {
                setError("Unexpected error. Please try again.");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setLoading(true);
        setError(null);
        try {
            const flowRes = await axios.get<KratosLoginFlow>(
                `${KRATOS_BROWSER_URL}/self-service/login/browser`,
                {
                    headers: { Accept: "application/json" },
                    params: { return_to: `${window.location.origin}/oauth/callback` },
                }
            );

            const flow = flowRes.data;
            const csrfToken =
                flow.ui.nodes.find((n) => n.attributes?.name === "csrf_token")
                    ?.attributes?.value ?? "";

            const form = document.createElement("form");
            form.method = "POST";
            form.action = flow.ui.action;
            form.style.display = "none";

            (
                [
                    ["csrf_token", csrfToken],
                    ["method", "oidc"],
                    ["provider", "google"],
                ] as [string, string][]
            ).forEach(([name, value]) => {
                const input = document.createElement("input");
                input.type = "hidden";
                input.name = name;
                input.value = value;
                form.appendChild(input);
            });

            document.body.appendChild(form);
            form.submit();
        } catch {
            setLoading(false);
            setError("Could not start Google login. Please try again.");
        }
    };

    return (
        <AuthLayout>
            <Card>
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                        <Lock className="text-white" size={32} />
                    </div>
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">My EconoCoach</h1>
                    <p className="text-gray-600">Sign in to your account to continue</p>
                </div>

                {/* Error Alert */}
                {error && (
                    <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start space-x-3 animate-shake">
                        <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
                        <div>
                            <p className="text-red-800 font-medium text-sm">{error}</p>
                        </div>
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-5">
                    <Input
                        type="email"
                        label="Email Address"
                        placeholder="Enter your email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        icon={<Mail size={20} />}
                        required
                    />

                    <Input
                        type={showPassword ? "text" : "password"}
                        label="Password"
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        icon={<Lock size={20} />}
                        rightIcon={
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        }
                        required
                    />

                    {/* Remember & Forgot */}
                    <div className="flex items-center justify-between">
                        <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={rememberMe}
                                onChange={(e) => setRememberMe(e.target.checked)}
                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-600">Remember me</span>
                        </label>
                        <button
                            type="button"
                            className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
                        >
                            Forgot password?
                        </button>
                    </div>

                    <Button
                        type="submit"
                        loading={loading}
                        fullWidth
                        variant="primary"
                    >
                        Sign In
                    </Button>
                </form>

                {/* Divider */}
                <div className="my-6 flex items-center">
                    <div className="flex-1 border-t border-gray-300"></div>
                    <span className="px-4 text-sm text-gray-500">or</span>
                    <div className="flex-1 border-t border-gray-300"></div>
                </div>

                {/* Social Login */}
                <Button variant="secondary" fullWidth onClick={handleGoogleLogin}>
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    <span>Continue with Google</span>
                </Button>

                {/* Sign Up Link */}
                <p className="mt-6 text-center text-sm text-gray-600">
                    Don't have an account?{' '}
                    <button
                        onClick={() => navigate("/signup")}
                        className="text-blue-600 hover:text-blue-700 font-semibold transition-colors"
                    >
                        Sign up
                    </button>
                </p>
            </Card>
        </AuthLayout>
    );
}
