export interface Account {
    countryCode: string;
    currency: string;
    annualIncome: number;
    monthlyInvestableAmount: number;
}

export interface MyExchangeRate {
    base: string;
    target: string;
    rate: number;
    lastUpdated?: string;
}

// Manage Account modal types

export interface AccountMe {
    email: string;
    name: string;
    loginProvider: "Google" | "Password";
}

export interface DeviceInfo {
    deviceId: string;
    browser: string;
    os: string;
    lastUsedAt: string | null;
    isCurrent: boolean;
}

export interface SessionsResponse {
    currentDevice: DeviceInfo | null;
    otherDevices: DeviceInfo[];
}