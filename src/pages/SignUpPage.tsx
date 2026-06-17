import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios, { AxiosError } from "axios";
import { Lock, Mail, Eye, EyeOff, AlertCircle, Check } from "lucide-react";
import { raiseAppError } from "@/common/errors/raiseAppError";

import AuthLayout from "../components/layouts/AuthLayout";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";

const KRATOS_BROWSER_URL = import.meta.env.VITE_KRATOS_BROWSER_URL;

interface KratosUiNode {
    attributes?: {
        name?: string;
        value?: string;
    };
    messages?: Array<{ type: string; text: string }>;
}

interface KratosRegistrationFlow {
    ui: {
        action: string;
        nodes: KratosUiNode[];
        messages?: Array<{ type: string; text: string }>;
    };
}

export default function SignUpPage() {
    const [formData, setFormData] = useState({
        email: "",
        password: "",
        confirmPassword: "",
    });
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [agreedToTerms, setAgreedToTerms] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const navigate = useNavigate();

    const getPasswordStrength = (password: string) => {
        if (password.length === 0) return { strength: 0, text: "" };
        if (password.length < 6) return { strength: 1, text: "Weak", color: "text-red-500" };
        if (password.length < 10) return { strength: 2, text: "Medium", color: "text-yellow-500" };
        return { strength: 3, text: "Strong", color: "text-green-500" };
    };

    const validatePassword = (password: string) => {
        const errors: string[] = [];
        if (password.length < 8) errors.push("At least 8 characters");
        if (!/[A-Z]/.test(password)) errors.push("At least one uppercase letter");
        if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) errors.push("At least one special character");
        return errors;
    };

    const passwordStrength = getPasswordStrength(formData.password);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const passwordErrors = validatePassword(formData.password);
        if (passwordErrors.length > 0) {
            const err = raiseAppError("CLIENT_VALIDATION_ERROR", navigate, passwordErrors[0]);
            setError(err.message);
            setLoading(false);
            return;
        }

        if (formData.password !== formData.confirmPassword) {
            const appError = raiseAppError(
                "CLIENT_VALIDATION_ERROR",
                navigate,
                "Password and confirm password do not match."
            );
            setError(appError.message);
            setLoading(false);
            return;
        }

        if (!agreedToTerms) {
            const appError = raiseAppError(
                "CLIENT_VALIDATION_ERROR",
                navigate,
                "Please agree to the terms and conditions."
            );
            setError(appError.message);
            setLoading(false);
            return;
        }

        try {
            // Step 1: Initialize Kratos self-service registration flow
            const flowRes = await axios.get<KratosRegistrationFlow>(
                `${KRATOS_BROWSER_URL}/self-service/registration/browser`,
                {
                    headers: { Accept: "application/json" },
                    withCredentials: true,
                }
            );
            const csrfToken =
                flowRes.data.ui.nodes.find((n) => n.attributes?.name === "csrf_token")
                    ?.attributes?.value ?? "";

            // Step 2: Submit registration credentials to Kratos
            // Creates a Kratos identity with email trait AND password credential.
            await axios.post(
                flowRes.data.ui.action,
                {
                    method: "password",
                    csrf_token: csrfToken,
                    traits: { email: formData.email },
                    password: formData.password,
                },
                {
                    headers: { "Content-Type": "application/json", Accept: "application/json" },
                    withCredentials: true,
                }
            );

            // Registration succeeded — redirect to login so the user can authenticate.
            navigate("/login");
        } catch (err: unknown) {
            if (err instanceof AxiosError) {
                if (err.response?.status === 400) {
                    const flowData = err.response.data as KratosRegistrationFlow;
                    const topMessage = flowData?.ui?.messages?.[0]?.text;
                    const nodeMessage = flowData?.ui?.nodes
                        ?.find((n) => (n.messages?.length ?? 0) > 0)
                        ?.messages?.[0]?.text;
                    setError(topMessage ?? nodeMessage ?? "Registration failed. Please try again.");
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

    return (
        <AuthLayout>
            <Card>
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                        <Lock className="text-white" size={32} />
                    </div>
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">
                        Create Account
                    </h1>
                    <p className="text-gray-600">Sign up to get started</p>
                </div>

                {/* Error Alert */}
                {error && (
                    <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start space-x-3 animate-shake">
                        <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
                        <p className="text-red-800 font-medium text-sm">{error}</p>
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Email */}
                    <Input
                        type="email"
                        name="email"
                        label="Email Address"
                        placeholder="Enter your email"
                        value={formData.email}
                        onChange={handleChange}
                        icon={<Mail size={20} />}
                        required
                    />

                    {/* Password */}
                    <Input
                        type={showPassword ? "text" : "password"}
                        name="password"
                        label="Password"
                        placeholder="Create a password"
                        value={formData.password}
                        onChange={handleChange}
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
                    {formData.password && (
                        <div className="text-sm space-y-1">
                            <p className={formData.password.length >= 8 ? "text-green-600" : "text-red-600"}>
                                • At least 8 characters
                            </p>
                            <p className={/[A-Z]/.test(formData.password) ? "text-green-600" : "text-red-600"}>
                                • At least one uppercase letter
                            </p>
                            <p
                                className={
                                    /[!@#$%^&*(),.?":{}|<>]/.test(formData.password)
                                        ? "text-green-600"
                                        : "text-red-600"
                                }
                            >
                                • At least one special character
                            </p>
                        </div>
                    )}

                    {/* Password Strength Bar */}
                    {formData.password && (
                        <div>
                            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                    className={`h-full transition-all ${passwordStrength.strength === 1
                                        ? "w-1/3 bg-red-500"
                                        : passwordStrength.strength === 2
                                            ? "w-2/3 bg-yellow-400"
                                            : passwordStrength.strength === 3
                                                ? "w-full bg-green-500"
                                                : "w-0"
                                        }`}
                                />
                            </div>
                            <p className={`text-sm mt-1 ${passwordStrength.color}`}>
                                {passwordStrength.text}
                            </p>
                        </div>
                    )}

                    {/* Confirm Password */}
                    <Input
                        type={showConfirmPassword ? "text" : "password"}
                        name="confirmPassword"
                        label="Confirm Password"
                        placeholder="Confirm your password"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        icon={<Lock size={20} />}
                        rightIcon={
                            <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        }
                        required
                    />

                    {/* Password Match Indicator */}
                    {formData.confirmPassword && (
                        <div
                            className={`flex items-center space-x-2 text-sm ${formData.password === formData.confirmPassword
                                ? "text-green-600"
                                : "text-red-600"
                                }`}
                        >
                            {formData.password === formData.confirmPassword ? (
                                <>
                                    <Check size={16} />
                                    <span>Passwords match</span>
                                </>
                            ) : (
                                <>
                                    <AlertCircle size={16} />
                                    <span>Passwords do not match</span>
                                </>
                            )}
                        </div>
                    )}

                    {/* Terms */}
                    <label className="flex items-start space-x-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={agreedToTerms}
                            onChange={(e) => setAgreedToTerms(e.target.checked)}
                            className="w-4 h-4 mt-1 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-600">
                            I agree to the{" "}
                            <span className="text-blue-600 font-medium">Terms</span> and{" "}
                            <span className="text-blue-600 font-medium">Privacy Policy</span>
                        </span>
                    </label>

                    <Button type="submit" loading={loading} fullWidth variant="primary">
                        Create Account
                    </Button>
                </form>

                {/* Divider */}
                <div className="my-6 flex items-center">
                    <div className="flex-1 border-t border-gray-300" />
                    <span className="px-4 text-sm text-gray-500">or</span>
                    <div className="flex-1 border-t border-gray-300" />
                </div>

                {/* Social Sign Up */}
                <Button variant="secondary" fullWidth>
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path
                            fill="#4285F4"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                            fill="#34A853"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                            fill="#FBBC05"
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        />
                        <path
                            fill="#EA4335"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                    </svg>
                    <span>Sign up with Google</span>
                </Button>

                {/* Login Link */}
                <p className="mt-6 text-center text-sm text-gray-600">
                    Already have an account?{" "}
                    <button
                        onClick={() => navigate("/login")}
                        className="text-blue-600 hover:text-blue-700 font-semibold transition-colors"
                    >
                        Sign in
                    </button>
                </p>
            </Card>
        </AuthLayout>
    );
}
