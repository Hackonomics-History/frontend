import { useState, useEffect, useCallback } from "react";
import { api } from "@/api/client";
import type { MyExchangeRateApiResponse } from "@/api/types";
import type { MyExchangeRate } from "@/domains/account/types";
import { mapMyExchangeRateFromApi } from "@/domains/account/mappers";

interface UseMyPageExchangeRateResult {
    rate: MyExchangeRate | null;
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
}

export function useMyPageExchangeRate(): UseMyPageExchangeRateResult {
    const [rate, setRate] = useState<MyExchangeRate | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchRate = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await api.get<MyExchangeRateApiResponse>("/api/account/me/exchange-rate/");
            const apiRate = res.data;
            if (!apiRate?.base || !apiRate?.target || typeof apiRate?.rate !== "number") {
                setRate(null);
                return;
            }
            setRate(mapMyExchangeRateFromApi(apiRate));
        } catch {
            // new users without an account are expected — not an error condition
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchRate();
    }, [fetchRate]);

    return { rate, isLoading, error, refresh: fetchRate };
}
