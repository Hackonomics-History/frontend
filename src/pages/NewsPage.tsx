import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import AppBackground from "@/components/layouts/AppBackground";
import NewsChatSidebar from "@/components/chat/NewsChatSidebar";
import Button from "@/components/ui/Button";
import { api } from "@/api/client";
import { raiseAppError } from "@/common/errors/raiseAppError";
import { Newspaper, RefreshCw, TrendingUp } from "lucide-react";
import type { NewsItem, BusinessNewsResponse, RefreshResponse } from "@/api/types";

function formatTime(value?: string | null) {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function getFlagEmoji(code?: string) {
    if (!code) return "";
    return code
        .toUpperCase()
        .replace(/./g, (char) =>
            String.fromCodePoint(127397 + char.charCodeAt(0))
        );
}

function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
}

export default function NewsPage() {
    const navigate = useNavigate();

    const [news, setNews] = useState<NewsItem[]>([]);
    const [countryCode, setCountryCode] = useState<string>();
    const [countryName, setCountryName] = useState<string>();
    const [loading, setLoading] = useState(true);

    const [lastUpdated, setLastUpdated] = useState<string | null>(null);
    const [nextUpdate, setNextUpdate] = useState<string | null>(null);
    const [intervalHours, setIntervalHours] = useState<number>(6);

    const [refreshing, setRefreshing] = useState(false);
    const [refreshQueuedFor, setRefreshQueuedFor] = useState<string | null>(null);

    const lastUpdatedLabel = useMemo(
        () => formatTime(lastUpdated),
        [lastUpdated]
    );

    const nextUpdateLabel = useMemo(
        () => formatTime(nextUpdate),
        [nextUpdate]
    );

    const fetchNews = useCallback(async () => {
        const res = await api.get<BusinessNewsResponse>(
            "/api/news/business-news/"
        );
        const data = res.data;

        setNews(Array.isArray(data.news) ? data.news : []);
        setCountryCode(data.country_code);
        setCountryName(data.country_name);
        setLastUpdated(data.last_updated);
        setNextUpdate(data.next_update);
        setIntervalHours(data.update_interval_hours ?? 6);

        return data;
    }, []);

    const loadNews = useCallback(async () => {
        try {
            setLoading(true);
            await fetchNews();
        } catch (err: unknown) {
            raiseAppError(err, navigate, "Failed to load business news");
        } finally {
            setLoading(false);
        }
    }, [fetchNews, navigate]);

    const pollUntilUpdated = useCallback(
        async (prevLastUpdated: string | null) => {
            const timeoutMs = 45_000;
            const intervalMs = 700;
            const started = Date.now();

            const prevTime = prevLastUpdated
                ? new Date(prevLastUpdated).getTime()
                : 0;

            while (Date.now() - started < timeoutMs) {
                await sleep(intervalMs);

                try {
                    const data = await fetchNews();

                    const newTime = data.last_updated
                        ? new Date(data.last_updated).getTime()
                        : 0;

                    if (newTime > prevTime) {
                        return true;
                    }
                } catch {
                    // ignore transient errors
                }
            }

            return false;
        },
        [fetchNews]
    );

    const onRefresh = useCallback(async () => {
        try {
            setRefreshing(true);
            setRefreshQueuedFor(null);

            const prev = lastUpdated;

            const res = await api.post<RefreshResponse>(
                "/api/news/business-news/refresh/"
            );

            setRefreshQueuedFor(res.data.country_code);

            await pollUntilUpdated(prev);

            // 🔥 Always fetch once more to guarantee UI sync
            await fetchNews();

        } catch (err: unknown) {
            raiseAppError(err, navigate, "Failed to refresh business news");
        } finally {
            setRefreshing(false);
        }
    }, [fetchNews, lastUpdated, navigate, pollUntilUpdated]);

    useEffect(() => {
        loadNews();
    }, [loadNews]);

    return (
        <AppBackground>
            <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-cyan-900 p-6 sm:p-10">
                <div className="max-w-4xl mx-auto">
                    <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-white/20">

                        {/* Header */}
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                                <Newspaper className="w-6 h-6 text-indigo-600" />
                                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                                    {countryCode && (
                                        <span className="text-2xl">
                                            {getFlagEmoji(countryCode)}
                                        </span>
                                    )}
                                    Business News
                                </h1>
                            </div>

                            <Button
                                onClick={onRefresh}
                                loading={refreshing}
                                size="sm"
                                variant="outline"
                                disabled={loading}
                                title="Fetch the latest news for your current account country"
                            >
                                <RefreshCw
                                    className={`w-4 h-4 mr-1 ${refreshing ? "animate-spin" : ""
                                        }`}
                                />
                                Refresh
                            </Button>
                        </div>

                        {/* Update Info */}
                        <div className="text-xs text-gray-500 mb-6 space-y-1">
                            <p>
                                Region:{" "}
                                <span className="font-medium">
                                    {countryName ?? "Not set"}
                                </span>{" "}
                                {countryCode && (
                                    <span className="text-gray-400">
                                        ({countryCode})
                                    </span>
                                )}
                            </p>

                            <p>
                                Last updated:{" "}
                                <span className="font-medium">
                                    {lastUpdatedLabel ?? "—"}
                                </span>
                            </p>

                            <p>
                                Next update:{" "}
                                <span className="font-medium">
                                    {nextUpdateLabel ?? "—"}
                                </span>
                                <span className="ml-2 text-gray-400">
                                    (auto every {intervalHours} hours)
                                </span>
                            </p>

                            {refreshing && (
                                <p className="text-indigo-600">
                                    Refresh queued
                                    {refreshQueuedFor
                                        ? ` for ${refreshQueuedFor}`
                                        : ""}{" "}
                                    … waiting for update
                                </p>
                            )}
                        </div>

                        {/* Subtitle */}
                        <p className="text-sm text-gray-500 mb-8">
                            Latest business developments affecting{" "}
                            {countryName || "your region"} and global markets.
                        </p>

                        {/* Loading Skeleton */}
                        {(loading || (refreshing && news.length === 0)) && (
                            <div className="space-y-4 animate-pulse">
                                {[1, 2, 3].map((i) => (
                                    <div
                                        key={i}
                                        className="p-4 rounded-xl bg-gray-200 h-24"
                                    />
                                ))}
                            </div>
                        )}

                        {/* News Cards */}
                        {!loading && news.length > 0 && (
                            <div className="space-y-4">
                                {news.map((item, idx) => (
                                    <div
                                        key={`${item.title}-${idx}`}
                                        className="p-5 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition bg-white"
                                    >
                                        <div className="flex items-start gap-3">
                                            <TrendingUp className="w-5 h-5 text-indigo-600 mt-1" />
                                            <div>
                                                <h2 className="font-semibold text-gray-900">
                                                    {item.title}
                                                </h2>
                                                <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                                                    {item.description}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Empty */}
                        {!loading && news.length === 0 && (
                            <p className="text-gray-500 text-center">
                                No recent business news.{" "}
                                {countryCode
                                    ? "Try Refresh."
                                    : "Set your country in Account first."}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Chat Sidebar */}
            <NewsChatSidebar news={news} />
        </AppBackground>
    );
}