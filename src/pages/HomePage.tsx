import { useEffect, useState, useCallback } from "react";
import { api } from "@/api/client";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import AppBackground from "@/components/layouts/AppBackground";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    CartesianGrid,
} from "recharts";

type HistoryPoint = {
    date: string;
    rate: number;
};

type ExchangeHistoryResponse = {
    base: string;
    target: string;
    period: string;
    end_date: string;
    history: HistoryPoint[];
};

type SimulationResult = {
    currency: string;
    period: string;
    monthly_amount: number;
    deposit_rate: number;
    usd: {
        invested: number;
        final: number;
    };
    deposit: {
        invested: number;
        final: number;
    };
    winner: "usd" | "deposit";
    diff_percent: number;
    summary: string;
};

const PERIODS = [
    { label: "3M", value: "3m" },
    { label: "6M", value: "6m" },
    { label: "1Y", value: "1y" },
    { label: "2Y", value: "2y" },
];

export default function HomePage() {
    const [currency, setCurrency] = useState<string | null>(null);
    const [period, setPeriod] = useState("6m");
    const [data, setData] = useState<HistoryPoint[]>([]);
    const [depositRate, setDepositRate] = useState("");
    const [simPeriod, setSimPeriod] = useState("1y");
    const [simulation, setSimulation] = useState<SimulationResult | null>(null);
    const [simLoading, setSimLoading] = useState(false);
    const [loading, setLoading] = useState(false);

    const loadAccountCurrency = useCallback(async () => {
        try {
            const res = await api.get("/api/account/me/");
            const userCurrency = res.data.currency;
            setCurrency(userCurrency);
        } catch {
            setCurrency("CAD");
        }
    }, []);

    const loadHistory = useCallback(async (cur: string) => {
        setLoading(true);
        try {
            const res = await api.get<ExchangeHistoryResponse>(
                "/api/exchange/history/",
                {
                    params: {
                        currency: cur,
                        period,
                    },
                }
            );
            setData(res.data.history);
        } finally {
            setLoading(false);
        }
    }, [period]);

    const runSimulation = async () => {
        if (!depositRate) return;

        setSimLoading(true);
        try {
            const res = await api.post<SimulationResult>(
                "/api/simulation/compare/dca-vs-deposit/",
                {
                    period: simPeriod,
                    deposit_rate: Number(depositRate),
                }
            );
            setSimulation(res.data);
        } finally {
            setSimLoading(false);
        }
    };

    useEffect(() => {
        loadAccountCurrency();
    }, [loadAccountCurrency]);

    useEffect(() => {
        if (!currency) return;
        loadHistory(currency);
    }, [currency, period, loadHistory]);

    return (
        <AppBackground>
            <div className="max-w-5xl mx-auto space-y-6">
                <Card className="h-[560px] flex flex-col">
                    {/* Header */}
                    <div className="text-center mb-6">
                        <h1 className="text-3xl font-bold text-gray-800">
                            {currency ? `USD → ${currency} Exchange History` : "Loading currency..."}
                        </h1>
                    </div>

                    {/* Chart */}
                    <div className="flex-1 mb-6">
                        {!currency ? (
                            <div className="h-full flex items-center justify-center text-gray-400">
                                Loading currency...
                            </div>
                        ) : loading ? (
                            <div className="h-full flex items-center justify-center text-gray-500">
                                Loading chart...
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={data}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="date" />
                                    <YAxis
                                        domain={[
                                            (dataMin: number) => dataMin * 0.995,
                                            (dataMax: number) => dataMax * 1.005,
                                        ]}
                                        tickFormatter={(value: number) => value.toFixed(2)}
                                        width={70}
                                    />
                                    <Tooltip
                                        formatter={(value) =>
                                            typeof value === "number" ? value.toFixed(2) : value
                                        }
                                        labelFormatter={(label) => `Date: ${label}`}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="rate"
                                        stroke="#6366f1"
                                        strokeWidth={2}
                                        dot={false}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        )}
                    </div>

                    {/* Period Buttons */}
                    <div className="flex justify-center gap-3">
                        {PERIODS.map((p) => (
                            <Button
                                key={p.value}
                                variant={period === p.value ? "primary" : "secondary"}
                                onClick={() => setPeriod(p.value)}
                                size="sm"
                                disabled={!currency || loading}
                            >
                                {p.label}
                            </Button>
                        ))}
                    </div>
                </Card>
                <Card>
                    <h2 className="text-2xl font-bold text-gray-800 mb-4">
                        Investment Comparison Simulation
                    </h2>

                    {/* Input Area */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div>
                            <label className="text-sm text-gray-600">Deposit Interest Rate (%)</label>
                            <input
                                type="number"
                                value={depositRate}
                                onChange={(e) => setDepositRate(e.target.value)}
                                className="w-full mt-1 p-2 border rounded-lg"
                                placeholder="e.g. 3.5"
                            />
                        </div>

                        <div>
                            <label className="text-sm text-gray-600">Period</label>
                            <select
                                value={simPeriod}
                                onChange={(e) => setSimPeriod(e.target.value)}
                                className="w-full mt-1 p-2 border rounded-lg"
                            >
                                <option value="1y">1 Year</option>
                                <option value="2y">2 Years</option>
                            </select>
                        </div>

                        <div className="flex items-end">
                            <Button
                                fullWidth
                                loading={simLoading}
                                onClick={runSimulation}
                                disabled={!currency}
                            >
                                Run Simulation
                            </Button>
                        </div>
                    </div>

                    {/* Result */}
                    {simulation && (
                        <div className="border rounded-xl overflow-hidden">
                            <div className="p-4 bg-gray-50 text-sm text-gray-700">
                                Monthly Investment: {simulation.monthly_amount} {simulation.currency} <br />
                                Deposit Rate: {simulation.deposit_rate}% <br />
                                Period: {simulation.period.toUpperCase()}
                            </div>

                            <div className="grid grid-cols-2 gap-4 p-4">
                                <div className="border rounded-lg p-4">
                                    <h3 className="font-bold mb-2">USD (DCA)</h3>
                                    <p>Invested: {simulation.usd.invested.toLocaleString()} {simulation.currency}</p>
                                    <p>Final: {simulation.usd.final.toLocaleString()} {simulation.currency}</p>
                                </div>

                                <div className="border rounded-lg p-4">
                                    <h3 className="font-bold mb-2">Fixed-Term Deposit</h3>
                                    <p>Invested: {simulation.deposit.invested.toLocaleString()} {simulation.currency}</p>
                                    <p>Final: {simulation.deposit.final.toLocaleString()} {simulation.currency}</p>
                                </div>
                            </div>

                            <div className="p-4 bg-indigo-50 text-center">
                                <p className="text-lg font-bold">
                                    🏆 Winner: {simulation.winner === "usd" ? "USD (DCA)" : "Deposit"}
                                </p>
                                <p className="text-indigo-700">
                                    Advantage: +{simulation.diff_percent}%
                                </p>
                                <p className="mt-2 text-sm text-gray-700">
                                    {simulation.summary}
                                </p>
                            </div>
                        </div>
                    )}
                </Card>
            </div>
        </AppBackground>
    );
}