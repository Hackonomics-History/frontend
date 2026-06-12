import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/useAuth";
import { api } from "../api/client";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const KRATOS_BROWSER_URL = import.meta.env.VITE_KRATOS_BROWSER_URL;
import {
    Globe,
    DollarSign,
    RefreshCw,
    Check,
    Search,
    TrendingUp,
    Clock,
    AlertCircle,
    User as UserIcon,
} from "lucide-react";
import { raiseAppError } from "@/common/errors/raiseAppError";

import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import AnimatedText from "@/components/ui/AnimatedText";

// API Types
import type { Country, ExchangeRate } from "@/api/types";
// Domain Types
import { mapAccountFromApi } from "@/domains/account/mappers";
import { useMyPageExchangeRate } from "@/domains/account/hooks/useMyPageExchangeRate";

export default function MyPage() {
    const { logout } = useAuth();
    const navigate = useNavigate();
    // Auth — only email is needed from the Kratos identity traits
    const [user, setUser] = useState<{ email: string } | null>(null);
    const [loading, setLoading] = useState(true);
    // Countries
    const [countries, setCountries] = useState<Country[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
    const [showCountryList, setShowCountryList] = useState(false);
    // Currency list
    const [selectedCurrency, setSelectedCurrency] = useState("");
    const [showCurrencyList, setShowCurrencyList] = useState(false);
    const [currencySearchQuery, setCurrencySearchQuery] = useState("");
    const [filteredCurrencies, setFilteredCurrencies] = useState<string[]>([]);
    // Exchange
    const [exchangeRate, setExchangeRate] = useState<ExchangeRate | null>(null);
    const { rate: myExchangeRate, refresh: refreshExchangeRate } = useMyPageExchangeRate();
    // Account Money
    const [annualIncome, setAnnualIncome] = useState("");
    const [monthlyInvestableAmount, setMonthlyInvestableAmount] = useState("");
    // UI
    const [saving, setSaving] = useState(false);
    const [updating, setUpdating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saveSuccess, setSaveSuccess] = useState(false);

    useEffect(() => {
        async function init() {
            try {
                const sessionRes = await axios.get(
                    `${KRATOS_BROWSER_URL}/sessions/whoami`,
                    { withCredentials: true }
                );
                setUser({ email: sessionRes.data.identity.traits?.email ?? "" });
            } catch (err) {
                raiseAppError(err, navigate);
                logout();
                return;
            }
            // 2) meta + account
            try {
                const countriesRes = await api.get("/api/meta/countries/");
                setCountries(countriesRes.data);

                await loadAccount(countriesRes.data);
            } catch (err) {
                const e = raiseAppError(err, navigate);
                setError(e.message);
            } finally {
                setLoading(false);
            }
        }

        init();
    }, [logout, navigate]);

    const filteredCountries = useMemo(() => {
        if (!searchQuery) return countries;
        const q = searchQuery.toLowerCase();
        return countries.filter((c) => c.name.toLowerCase().startsWith(q));
    }, [searchQuery, countries]);

    // currency filter
    useEffect(() => {
        if (!selectedCountry) return;

        if (!currencySearchQuery) {
            setFilteredCurrencies(selectedCountry.currencies);
            return;
        }

        const q = currencySearchQuery.toUpperCase();
        setFilteredCurrencies(selectedCountry.currencies.filter((c) => c.includes(q)));
    }, [currencySearchQuery, selectedCountry]);

    const loadAccount = async (countriesList: Country[]) => {
        try {
            const res = await api.get("/api/account/me/");
            const domainAccount = mapAccountFromApi(res.data);

            setAnnualIncome(String(domainAccount.annualIncome));
            setMonthlyInvestableAmount(String(domainAccount.monthlyInvestableAmount));

            const country = countriesList.find((c) => c.code === domainAccount.countryCode);
            if (country) {
                setSelectedCountry(country);
                setFilteredCurrencies(country.currencies);
                setSelectedCurrency(domainAccount.currency);
            }
        } catch {
            // not exist account user for New user
        }
    };

    const handleCountrySelect = async (country: Country) => {
        setSelectedCountry(country);
        setShowCountryList(false);
        setSearchQuery("");
        setError(null);
        // currency list reset
        setFilteredCurrencies(country.currencies);
        setCurrencySearchQuery("");

        const defaultCurrency = country.default_currency ?? country.currencies[0];
        setSelectedCurrency(defaultCurrency);
        setShowCurrencyList(false);

        try {
            const rateRes = await api.get(`/api/exchange/usd-to/${defaultCurrency}/`);
            setExchangeRate(rateRes.data);
        } catch (err) {
            const e = raiseAppError(err, navigate);
            setError(e.message);
        }
    };

    const handleCurrencySelect = async (currency: string) => {
        setSelectedCurrency(currency);
        setShowCurrencyList(false);
        setCurrencySearchQuery("");
        setError(null);

        try {
            const res = await api.get(`/api/exchange/usd-to/${currency}/`);
            setExchangeRate(res.data);
        } catch (err) {
            const e = raiseAppError(err, navigate);
            setError(e.message);
        }
    };

    const handleSave = async () => {
        if (!selectedCountry || !selectedCurrency) {
            const e = raiseAppError(
                "CLIENT_VALIDATION_ERROR",
                navigate,
                "Please select a country and currency"
            );
            setError(e.message);
            return;
        }

        if (!annualIncome || !monthlyInvestableAmount) {
            const e = raiseAppError(
                "CLIENT_VALIDATION_ERROR",
                navigate,
                "Please enter your annual income and monthly investable amount"
            );
            setError(e.message);
            return;
        }

        setSaving(true);
        setSaveSuccess(false);
        setError(null);

        try {
            await api.put("/api/account/me/", {
                country_code: selectedCountry.code,
                currency: selectedCurrency,
                annual_income: annualIncome,
                monthly_investable_amount: monthlyInvestableAmount,
            });

            setSaveSuccess(true);
            await refreshExchangeRate();
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (err) {
            const e = raiseAppError(err, navigate);
            setError(e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleUpdateExchangeRate = async () => {
        setUpdating(true);
        try {
            await refreshExchangeRate();
        } catch (err) {
            raiseAppError(err, navigate);
        } finally {
            setUpdating(false);
        }
    };

    const formatDate = (d?: string) => {
        if (!d) return "Never";
        return new Date(d).toLocaleString();
    };

    const displayRate = exchangeRate ?? myExchangeRate;

    // UI
    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-cyan-900 flex items-center justify-center text-white text-xl">
                Loading...
            </div>
        );
    }

    if (!user) {
        return (
            <div className="min-h-screen flex items-center justify-center text-white">
                Failed to load user
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-cyan-900 p-8">
            <div className="max-w-4xl mx-auto space-y-6">
                {/* Header */}
                <div className="text-center text-white mb-8">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-lg">
                        <UserIcon className="text-white" size={32} />
                    </div>
                    <h1 className="text-4xl font-bold">My Account</h1>
                    <p className="text-blue-200">Welcome, {user?.email ?? "User"}</p>
                </div>

                {/* Success Alert */}
                {saveSuccess && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center space-x-3">
                        <Check className="text-green-500" size={20} />
                        <AnimatedText
                            text="Settings saved successfully!"
                            className="text-green-800 font-medium text-sm"
                        />
                    </div>
                )}

                {/* Error Alert */}
                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start space-x-3">
                        <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
                        <AnimatedText
                            text={error}
                            className="text-red-800 font-medium text-sm"
                        />
                    </div>
                )}

                {/* Country Selection */}
                <Card>
                    <div className="flex items-center space-x-3 mb-6">
                        <Globe className="text-blue-600" size={24} />
                        <h2 className="text-2xl font-bold text-gray-800">Select Your Country</h2>
                    </div>

                    {selectedCountry && !showCountryList && (
                        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                                {selectedCountry.flag ? (
                                    <img
                                        src={selectedCountry.flag}
                                        alt={selectedCountry.name}
                                        className="w-10 h-6 rounded shadow"
                                    />
                                ) : (
                                    <div className="flex items-center justify-center w-10 h-6 rounded shadow bg-gray-200 text-sm">
                                        🌍
                                    </div>
                                )}
                                <div>
                                    <p className="text-sm text-gray-600">Selected Country</p>
                                    <p className="text-lg font-semibold text-gray-800">
                                        {selectedCountry.name} ({selectedCountry.code})
                                    </p>
                                    <p className="text-sm text-gray-600">
                                        Default Currency: {selectedCountry.default_currency}
                                    </p>
                                </div>
                            </div>
                            <Button onClick={() => setShowCountryList(true)} variant="outline" size="md">
                                Change
                            </Button>
                        </div>
                    )}

                    {(!selectedCountry || showCountryList) && (
                        <>
                            <Input
                                type="text"
                                placeholder="Search countries..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                icon={<Search size={20} />}
                            />

                            <div className="mt-4 max-h-64 overflow-y-auto space-y-2">
                                {filteredCountries.map((country) => (
                                    <button
                                        key={`${country.code || "NO_CODE"}-${country.name}`}
                                        onClick={() => handleCountrySelect(country)}
                                        className="w-full p-4 bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-xl transition-all text-left"
                                    >
                                        <div className="flex items-center space-x-4">
                                            {country.flag ? (
                                                <img src={country.flag} alt={country.name} className="w-8 h-5 rounded" />
                                            ) : (
                                                <div className="flex items-center justify-center w-8 h-5 rounded bg-gray-200">
                                                    🌍
                                                </div>
                                            )}
                                            <div>
                                                <p className="font-semibold text-gray-800">{country.name}</p>
                                                <p className="text-sm text-gray-600">
                                                    {country.code} • {country.default_currency}
                                                </p>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </Card>

                {/* Currency Selection */}
                {selectedCountry && (
                    <Card>
                        <div className="flex items-center space-x-3 mb-6">
                            <DollarSign className="text-green-600" size={24} />
                            <h2 className="text-2xl font-bold text-gray-800">Currency</h2>
                        </div>

                        {/* Selected Currency */}
                        {selectedCurrency && !showCurrencyList && (
                            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600">Selected Currency</p>
                                    <p className="text-lg font-semibold text-gray-800">{selectedCurrency}</p>
                                </div>
                                <Button onClick={() => setShowCurrencyList(true)} variant="outline" size="md">
                                    Change
                                </Button>
                            </div>
                        )}

                        {/* Currency Search + List */}
                        {showCurrencyList && (
                            <>
                                <Input
                                    type="text"
                                    placeholder="Search currency (e.g. KRW, USD, EUR...)"
                                    value={currencySearchQuery}
                                    onChange={(e) => setCurrencySearchQuery(e.target.value)}
                                    icon={<Search size={20} />}
                                />

                                <div className="mt-4 max-h-48 overflow-y-auto space-y-2">
                                    {filteredCurrencies.map((currency) => (
                                        <button
                                            key={currency}
                                            onClick={() => handleCurrencySelect(currency)}
                                            className="w-full p-3 bg-gray-50 hover:bg-green-50 border border-gray-200 hover:border-green-300 rounded-xl transition-all text-left"
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="font-semibold text-gray-800">{currency}</span>
                                                {selectedCurrency === currency && <Check className="text-green-600" size={20} />}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}

                        {displayRate && (
                            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-xl">
                                <p className="text-sm text-gray-600 mb-1">Current Exchange Rate</p>
                                <AnimatedText
                                    text={`1 ${displayRate.base} = ${displayRate.rate.toFixed(4)} ${displayRate.target}`}
                                    className="text-2xl font-bold text-gray-800"
                                />
                            </div>
                        )}
                    </Card>
                )}

                {/* Financial Info */}
                <Card>
                    <div className="flex items-center space-x-3 mb-6">
                        <DollarSign className="text-green-600" size={24} />
                        <h2 className="text-2xl font-bold text-gray-800">Financial Info</h2>
                    </div>

                    <div className="space-y-4">
                        {/* Annual Income */}
                        <div className="relative">
                            <Input
                                type="number"
                                placeholder="Annual Income (e.g. 50000)"
                                value={annualIncome}
                                onChange={(e) => setAnnualIncome(e.target.value)}
                                icon={<TrendingUp size={20} />}
                                label="Annual Income"
                            />
                            {selectedCurrency && (
                                <span className="absolute right-4 top-[42px] px-2 py-1 bg-gray-100 border border-gray-300 rounded-md text-xs font-semibold text-gray-600">
                                    {selectedCurrency}
                                </span>
                            )}
                        </div>

                        {/* Monthly Investable Amount */}
                        <div className="relative">
                            <Input
                                type="number"
                                placeholder="Monthly Investable Amount (e.g. 1000)"
                                value={monthlyInvestableAmount}
                                onChange={(e) => setMonthlyInvestableAmount(e.target.value)}
                                icon={<DollarSign size={20} />}
                                label="Monthly Investable Amount"
                            />
                            {selectedCurrency && (
                                <span className="absolute right-4 top-[42px] px-2 py-1 bg-gray-100 border border-gray-300 rounded-md text-xs font-semibold text-gray-600">
                                    {selectedCurrency}
                                </span>
                            )}
                        </div>
                    </div>
                </Card>
                <Button
                    onClick={handleSave}
                    loading={saving}
                    fullWidth
                    variant="primary"
                    className="mt-4"
                >
                    Save Settings
                </Button>

                {/* My Exchange Rate */}
                {
                    myExchangeRate && (
                        <Card>
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center space-x-3">
                                    <TrendingUp className="text-purple-600" size={24} />
                                    <h2 className="text-2xl font-bold text-gray-800">My Exchange Rate</h2>
                                </div>

                                <div className="flex items-center space-x-4">
                                    {myExchangeRate.lastUpdated && (
                                        <div className="flex items-center space-x-1 text-sm text-gray-500">
                                            <Clock size={14} />
                                            <span>{formatDate(myExchangeRate.lastUpdated)}</span>
                                        </div>
                                    )}

                                    <Button
                                        onClick={handleUpdateExchangeRate}
                                        loading={updating}
                                        variant="secondary"
                                        size="md"
                                    >
                                        <RefreshCw size={16} />
                                        <span>Update</span>
                                    </Button>
                                </div>
                            </div>

                            <div className="p-6 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-xl">
                                <p className="text-sm text-gray-600 mb-2">Current Rate</p>
                                <AnimatedText
                                    text={`1 ${myExchangeRate.base} = ${myExchangeRate.rate.toFixed(4)} ${myExchangeRate.target}`}
                                    className="text-3xl font-bold text-gray-800 mb-4"
                                />

                                {myExchangeRate.lastUpdated && (
                                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                                        <Clock size={16} />
                                        <span>Last updated: {formatDate(myExchangeRate.lastUpdated)}</span>
                                    </div>
                                )}
                            </div>
                        </Card>
                    )
                }
            </div >
        </div >
    );
}