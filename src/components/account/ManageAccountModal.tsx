import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/useAuth";
import { raiseAppError } from "@/common/errors/raiseAppError";
import {
    getAccountMe,
    getAccountSessions,
    logoutDevices,
    logoutOtherDevices,
} from "@/api/account";
import { api } from "@/api/client";
import type { AccountMe, DeviceInfo, SessionsResponse } from "@/domains/account/types";
import Button from "@/components/ui/Button";

interface ManageAccountModalProps {
    isOpen: boolean;
    onClose: () => void;
}

function formatRelativeTime(isoString: string | null): string {
    if (!isoString) return "Never";
    const diff = Date.now() - new Date(isoString).getTime();
    const minutes = Math.floor(diff / 60_000);
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days !== 1 ? "s" : ""} ago`;
}

export default function ManageAccountModal({ isOpen, onClose }: ManageAccountModalProps) {
    const navigate = useNavigate();
    const { logout } = useAuth();

    const [accountMe, setAccountMe] = useState<AccountMe | null>(null);
    const [sessions, setSessions] = useState<SessionsResponse | null>(null);
    const [selectedDevices, setSelectedDevices] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [me, sess] = await Promise.all([getAccountMe(), getAccountSessions()]);
            setAccountMe(me);
            setSessions(sess);
            setSelectedDevices(new Set());
        } catch (err) {
            const e = raiseAppError(err, navigate);
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, [navigate]);

    useEffect(() => {
        if (isOpen) {
            load();
        }
    }, [isOpen, load]);

    const toggleDevice = (deviceId: string) => {
        setSelectedDevices((prev) => {
            const next = new Set(prev);
            if (next.has(deviceId)) {
                next.delete(deviceId);
            } else {
                next.add(deviceId);
            }
            return next;
        });
    };

    const handleLogoutSelected = async () => {
        if (selectedDevices.size === 0) return;
        setActionLoading(true);
        setError(null);
        try {
            await logoutDevices([...selectedDevices]);
            await load();
        } catch (err) {
            const e = raiseAppError(err, navigate);
            setError(e.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleLogoutOther = async () => {
        setActionLoading(true);
        setError(null);
        try {
            await logoutOtherDevices();
            await load();
        } catch (err) {
            const e = raiseAppError(err, navigate);
            setError(e.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleLogoutAll = async () => {
        setActionLoading(true);
        setError(null);
        try {
            const csrf =
                document.cookie
                    .split("; ")
                    .find((row) => row.startsWith("__csrf="))
                    ?.split("=")[1] ?? "";
            await api.post("/bff/logout-all", {}, { headers: { "X-CSRF-Token": csrf } });
            logout();
            navigate("/login");
        } catch (err) {
            const e = raiseAppError(err, navigate);
            setError(e.message);
        } finally {
            setActionLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                    <h2 className="text-xl font-bold text-gray-900">Manage Account</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                        aria-label="Close"
                    >
                        ×
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm">
                            {error}
                        </div>
                    )}

                    {loading ? (
                        <div className="text-center text-gray-400 py-8">Loading…</div>
                    ) : (
                        <>
                            {accountMe && (
                                <section>
                                    <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
                                        Account
                                    </h3>
                                    <div className="space-y-2">
                                        <InfoRow label="Email" value={accountMe.email} />
                                        {accountMe.name && (
                                            <InfoRow label="Name" value={accountMe.name} />
                                        )}
                                        <InfoRow label="Login Provider" value={accountMe.loginProvider} />
                                    </div>
                                </section>
                            )}

                            <hr className="border-gray-100" />

                            {sessions?.currentDevice && (
                                <section>
                                    <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
                                        Current Device
                                    </h3>
                                    <DeviceCard device={sessions.currentDevice} />
                                </section>
                            )}

                            {sessions && sessions.otherDevices.length > 0 && (
                                <section>
                                    <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
                                        Other Sessions
                                    </h3>
                                    <div className="space-y-2">
                                        {sessions.otherDevices.map((device) => (
                                            <DeviceCard
                                                key={device.deviceId}
                                                device={device}
                                                selectable
                                                selected={selectedDevices.has(device.deviceId)}
                                                onToggle={toggleDevice}
                                            />
                                        ))}
                                    </div>
                                </section>
                            )}

                            <div className="space-y-2 pt-2">
                                {sessions && sessions.otherDevices.length > 0 && (
                                    <>
                                        <Button
                                            fullWidth
                                            variant="outline"
                                            size="md"
                                            loading={actionLoading}
                                            disabled={selectedDevices.size === 0 || actionLoading}
                                            onClick={handleLogoutSelected}
                                        >
                                            Logout Selected Devices
                                        </Button>
                                        <Button
                                            fullWidth
                                            variant="secondary"
                                            size="md"
                                            loading={actionLoading}
                                            disabled={actionLoading}
                                            onClick={handleLogoutOther}
                                        >
                                            Logout Other Devices
                                        </Button>
                                    </>
                                )}
                                <Button
                                    fullWidth
                                    variant="primary"
                                    size="md"
                                    loading={actionLoading}
                                    disabled={actionLoading}
                                    onClick={handleLogoutAll}
                                >
                                    Logout All Devices
                                </Button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

interface InfoRowProps {
    label: string;
    value: string;
}

function InfoRow({ label, value }: InfoRowProps) {
    return (
        <div className="flex justify-between items-center py-1">
            <span className="text-sm text-gray-500">{label}</span>
            <span className="text-sm font-medium text-gray-900">{value}</span>
        </div>
    );
}

interface DeviceCardProps {
    device: DeviceInfo;
    selectable?: boolean;
    selected?: boolean;
    onToggle?: (deviceId: string) => void;
}

function DeviceCard({ device, selectable = false, selected = false, onToggle }: DeviceCardProps) {
    const handleClick = selectable && onToggle ? () => onToggle(device.deviceId) : undefined;

    return (
        <div
            className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${
                device.isCurrent
                    ? "border-blue-200 bg-blue-50"
                    : selected
                    ? "border-blue-300 bg-blue-50"
                    : "border-gray-200 bg-gray-50 hover:border-gray-300"
            } ${selectable ? "cursor-pointer" : ""}`}
            onClick={handleClick}
            role={selectable ? "checkbox" : undefined}
            aria-checked={selectable ? selected : undefined}
        >
            {selectable && (
                <div
                    className={`mt-0.5 w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center ${
                        selected ? "border-blue-600 bg-blue-600" : "border-gray-300"
                    }`}
                >
                    {selected && (
                        <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 12 12" fill="none">
                            <path
                                d="M2 6l3 3 5-5"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    )}
                </div>
            )}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 truncate">
                        {device.browser}
                    </span>
                    {device.isCurrent && (
                        <span className="text-xs text-blue-600 font-medium">Current</span>
                    )}
                </div>
                <p className="text-xs text-gray-500">{device.os}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                    {device.isCurrent
                        ? "Active now"
                        : `Last active ${formatRelativeTime(device.lastUsedAt)}`}
                </p>
            </div>
        </div>
    );
}
