import { api } from "@/api/client";
import type { AccountMe, SessionsResponse } from "@/domains/account/types";

function csrfToken(): string {
    return (
        document.cookie
            .split("; ")
            .find((row) => row.startsWith("__csrf="))
            ?.split("=")[1] ?? ""
    );
}

export async function getAccountMe(): Promise<AccountMe> {
    const res = await api.get<AccountMe>("/bff/account/me");
    return res.data;
}

export async function getAccountSessions(): Promise<SessionsResponse> {
    const res = await api.get<SessionsResponse>("/bff/account/sessions");
    return res.data;
}

export async function logoutDevices(deviceIds: string[]): Promise<void> {
    await api.post(
        "/bff/logout-devices",
        { deviceIds },
        { headers: { "X-CSRF-Token": csrfToken() } }
    );
}

export async function logoutOtherDevices(): Promise<void> {
    await api.post(
        "/bff/logout-other-devices",
        {},
        { headers: { "X-CSRF-Token": csrfToken() } }
    );
}
