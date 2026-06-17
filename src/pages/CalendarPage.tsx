import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/api/client";
import Button from "@/components/ui/Button";
import AppBackground from "@/components/layouts/AppBackground";
import { raiseAppError } from "@/common/errors/raiseAppError";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import type { CalendarEvent } from "@/api/types";
import CalendarGrid from "@/components/calendar/CalendarGrid";
import EventSideEditor from "@/components/calendar/EventSideEditor";
import CategoryModal from "@/components/calendar/CategoryModal";

// --- Types ---
type Category = { id: string; name: string; color?: string; };
type EditingEvent = { id: string; title: string; start_at: string; end_at: string; estimated_cost?: number | null; };

interface AIAdvice {
    title: string;
    description: string;
    event_ids: string[];
    priority: "HIGH" | "MEDIUM" | "LOW";
}

// --- Helpers ---
const utcMonthAnchor = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
const toUtcIso = (localDateTime: string) => new Date(localDateTime + ":00.000Z").toISOString();
const priorityOrder = (p: "HIGH" | "MEDIUM" | "LOW") => {
    const map = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    return map[p];
};

export default function CalendarPage() {
    const navigate = useNavigate();

    // Standard State
    const [currentDate, setCurrentDate] = useState(() => utcMonthAnchor(new Date()));
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
    const [isSideEditorOpen, setIsSideEditorOpen] = useState(false);
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
    const [editingEvent, setEditingEvent] = useState<EditingEvent | null>(null);

    const [newEvent, setNewEvent] = useState({ title: "", start_at: "", end_at: "", estimated_cost: "" });
    const [newCategory, setNewCategory] = useState({ name: "", color: "#3b82f6" });

    // AI Advisor State
    const [documentText, setDocumentText] = useState("");
    const [advice, setAdvice] = useState<AIAdvice[] | null>(null);
    const [adviceLoading, setAdviceLoading] = useState(false);
    const [highlightedEventIds, setHighlightedEventIds] = useState<Set<string>>(new Set());

    const loadEvents = useCallback(async () => {
        try {
            const res = await api.get("/api/calendar/events/");
            setEvents(res.data);
        } catch (err) { raiseAppError(err, navigate, "Failed to load calendar events"); }
    }, [navigate]);

    const loadCategories = useCallback(async () => {
        try {
            const res = await api.get("/api/calendar/categories/");
            setCategories(res.data);
        } catch (err) { raiseAppError(err, navigate, "Failed to load categories"); }
    }, [navigate]);

    useEffect(() => {
        loadCategories();
        loadEvents();
    }, [loadCategories, loadEvents]);
    // AI Logic
    const findEventById = (id: string) => events.find(e => e.id === id);

    const analyzeWithAI = async () => {
        if (!documentText.trim()) return;

        setAdviceLoading(true);
        setAdvice(null);
        setHighlightedEventIds(new Set());
        try {
            const res = await api.post("/api/calendar/advice/", {
                document_text: documentText
            });
            const raw = res.data.advice;
            const parsed: AIAdvice[] = Array.isArray(raw) ? raw : [raw];

            parsed.sort(
                (a, b) =>
                    priorityOrder(a.priority) - priorityOrder(b.priority)
            );

            const affected = new Set<string>();
            parsed.forEach(a => {
                a.event_ids.forEach(id => affected.add(id));
            });
            setHighlightedEventIds(affected);

            setAdvice(parsed);
        } catch (err) {
            const msg =
                (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
                "AI analysis failed";
            raiseAppError(err, navigate, msg);
        } finally {
            setAdviceLoading(false);
        }
    };

    const openEventFromAdvice = (eventId: string) => {
        const ev = findEventById(eventId);
        if (!ev) return;

        setEditingEvent(ev);
        setNewEvent({
            title: ev.title,
            start_at: new Date(ev.start_at).toISOString().slice(0, 16),
            end_at: new Date(ev.end_at).toISOString().slice(0, 16),
            estimated_cost: ev.estimated_cost?.toString() ?? "",
        });
        setSelectedCategoryIds(ev.category_ids ?? []);
        setIsSideEditorOpen(true);
    };

    // Event Actions
    const openCreateEditor = async () => {
        const start = new Date();
        const end = new Date(start.getTime() + 60 * 60 * 1000);
        setNewEvent({ title: "", start_at: start.toISOString().slice(0, 16), end_at: end.toISOString().slice(0, 16), estimated_cost: "" });
        setSelectedCategoryIds([]);
        setEditingEvent(null);
        setIsSideEditorOpen(true);
    };

    const submitCreateEvent = async () => {
        try {
            await api.post("/api/calendar/events/", { ...newEvent, category_ids: selectedCategoryIds, start_at: toUtcIso(newEvent.start_at), end_at: toUtcIso(newEvent.end_at) });
            await loadEvents();
            setIsSideEditorOpen(false);
        } catch (err) { raiseAppError(err, navigate, "Failed to create event"); }
    };

    const submitUpdateEvent = async () => {
        if (!editingEvent) return;
        try {
            await api.put(`/api/calendar/events/${editingEvent.id}/`, { ...newEvent, category_ids: selectedCategoryIds, start_at: toUtcIso(newEvent.start_at), end_at: toUtcIso(newEvent.end_at) });
            await loadEvents();
            setIsSideEditorOpen(false);
        } catch (err) { raiseAppError(err, navigate, "Failed to update event"); }
    };

    const deleteEvent = async () => {
        if (!editingEvent || !confirm("Delete event?")) return;
        try {
            await api.delete(`/api/calendar/events/${editingEvent.id}/`);
            await loadEvents();
            setIsSideEditorOpen(false);
        } catch (err) { raiseAppError(err, navigate, "Failed to delete event"); }
    };

    return (
        <AppBackground>
            <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-cyan-900 p-8">
                <div className="max-w-7xl mx-auto space-y-6">

                    {/* MAIN CALENDAR CARD */}
                    <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-white/20">

                        {/* HEADER */}
                        <div className="flex items-center justify-between mb-8">
                            <h1 className="text-3xl font-bold text-gray-800">
                                {new Intl.DateTimeFormat("en-US", {
                                    month: "long",
                                    year: "numeric",
                                    timeZone: "UTC",
                                }).format(currentDate)}
                            </h1>

                            <div className="flex items-center space-x-4">
                                <Button
                                    onClick={() =>
                                        setCurrentDate((d) =>
                                            new Date(
                                                Date.UTC(
                                                    d.getUTCFullYear(),
                                                    d.getUTCMonth() - 1,
                                                    1
                                                )
                                            )
                                        )
                                    }
                                    size="sm"
                                    variant="outline"
                                >
                                    <ChevronLeft />
                                </Button>

                                <Button
                                    onClick={() =>
                                        setCurrentDate(utcMonthAnchor(new Date()))
                                    }
                                    size="md"
                                >
                                    Today
                                </Button>

                                <Button
                                    onClick={() =>
                                        setCurrentDate((d) =>
                                            new Date(
                                                Date.UTC(
                                                    d.getUTCFullYear(),
                                                    d.getUTCMonth() + 1,
                                                    1
                                                )
                                            )
                                        )
                                    }
                                    size="sm"
                                    variant="outline"
                                >
                                    <ChevronRight />
                                </Button>

                                <Button
                                    onClick={() => setIsCategoryModalOpen(true)}
                                    size="md"
                                >
                                    Categories
                                </Button>

                                <Button onClick={openCreateEditor} size="md">
                                    New Event
                                </Button>
                            </div>
                        </div>

                        {/* CALENDAR GRID */}
                        <CalendarGrid
                            currentDate={currentDate}
                            events={events}
                            highlightedEventIds={highlightedEventIds}
                            onEventClick={(event) => {
                                setEditingEvent(event);
                                setNewEvent({
                                    title: event.title,
                                    start_at: new Date(event.start_at)
                                        .toISOString()
                                        .slice(0, 16),
                                    end_at: new Date(event.end_at)
                                        .toISOString()
                                        .slice(0, 16),
                                    estimated_cost:
                                        event.estimated_cost?.toString() ?? "",
                                });
                                setSelectedCategoryIds(event.category_ids ?? []);
                                setIsSideEditorOpen(true);
                            }}
                        />

                        {/* ========== AI ADVISOR PANEL ========== */}
                        <div className="mt-8 bg-gray-50/50 rounded-2xl p-6 border border-gray-100">
                            <div className="flex items-center gap-2 mb-4">
                                <CalendarIcon className="w-5 h-5 text-indigo-600" />
                                <h2 className="text-lg font-bold text-gray-800">
                                    AI Advisor
                                </h2>
                            </div>

                            <textarea
                                className="w-full border border-gray-200 rounded-xl p-4 text-sm mb-4 outline-none focus:ring-2 focus:ring-indigo-500"
                                rows={3}
                                placeholder="Paste news link or document text..."
                                value={documentText}
                                onChange={(e) => setDocumentText(e.target.value)}
                            />

                            <Button
                                onClick={analyzeWithAI}
                                loading={adviceLoading}
                                disabled={!documentText.trim()}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white"
                            >
                                Analyze My Schedule
                            </Button>

                            {adviceLoading && (
                                <div className="mt-6 space-y-3 animate-pulse">
                                    <div className="h-20 bg-gray-200 rounded-xl w-full" />
                                    <div className="h-20 bg-gray-200 rounded-xl w-full" />
                                </div>
                            )}

                            {advice && advice.length > 0 && (
                                <div className="mt-6 space-y-4">
                                    {advice.map((item, idx) => (
                                        <div
                                            key={`${item.title}-${idx}`}
                                            className={`
                                                p-4 rounded-xl border shadow-sm
                                                ${item.priority === "HIGH"
                                                    ? "bg-red-50 border-red-200"
                                                    : ""
                                                }
                                                ${item.priority === "MEDIUM"
                                                    ? "bg-yellow-50 border-yellow-200"
                                                    : ""
                                                }
                                                ${item.priority === "LOW"
                                                    ? "bg-gray-50 border-gray-200"
                                                    : ""
                                                }
                                            `}
                                        >
                                            <div className="flex items-center gap-2 mb-1">
                                                <span
                                                    className={`
                                                        text-xs font-semibold px-2 py-1 rounded-full
                                                        ${item.priority === "HIGH"
                                                            ? "bg-red-500 text-white"
                                                            : ""
                                                        }
                                                        ${item.priority === "MEDIUM"
                                                            ? "bg-yellow-500 text-white"
                                                            : ""
                                                        }
                                                        ${item.priority === "LOW"
                                                            ? "bg-gray-500 text-white"
                                                            : ""
                                                        }
                                                    `}
                                                >
                                                    {item.priority}
                                                </span>

                                                <div className="font-bold text-gray-900">
                                                    {item.title}
                                                </div>
                                            </div>

                                            <p className="text-sm text-gray-700">
                                                {item.description}
                                            </p>

                                            {/* === MULTIPLE CLICKABLE EVENTS === */}
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                {item.event_ids.map((eventId) => {
                                                    const ev = findEventById(eventId);
                                                    if (!ev) return null;

                                                    return (
                                                        <Button
                                                            key={ev.id}
                                                            onClick={() =>
                                                                openEventFromAdvice(ev.id)
                                                            }
                                                            size="sm"
                                                            variant="outline"
                                                            className="
                                                                text-xs px-2 py-1 rounded-full
                                                                bg-indigo-50 text-indigo-700
                                                                hover:bg-indigo-100 transition
                                                                border border-indigo-200
                                                            "
                                                        >
                                                            📅 {ev.title || "Untitled Event"}
                                                        </Button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* MODALS / EDITORS */}
                <EventSideEditor
                    isOpen={isSideEditorOpen}
                    editingEvent={editingEvent}
                    newEvent={newEvent}
                    categories={categories}
                    selectedCategoryIds={selectedCategoryIds}
                    onChangeEvent={(field, value) =>
                        setNewEvent((prev) => ({ ...prev, [field]: value }))
                    }
                    onToggleCategory={(id) =>
                        setSelectedCategoryIds((prev) =>
                            prev.includes(id)
                                ? prev.filter((x) => x !== id)
                                : [...prev, id]
                        )
                    }
                    onClose={() => setIsSideEditorOpen(false)}
                    onSubmit={
                        editingEvent ? submitUpdateEvent : submitCreateEvent
                    }
                    onDelete={deleteEvent}
                />

                <CategoryModal
                    isOpen={isCategoryModalOpen}
                    categories={categories}
                    newCategory={newCategory}
                    isColorPickerOpen={isColorPickerOpen}
                    onChangeName={(v) =>
                        setNewCategory({ ...newCategory, name: v })
                    }
                    onSelectColor={(c) => {
                        setNewCategory({ ...newCategory, color: c });
                        setIsColorPickerOpen(false);
                    }}
                    onToggleColorPicker={() =>
                        setIsColorPickerOpen((p) => !p)
                    }
                    onCreate={async () => {
                        await api.post(
                            "/api/calendar/categories/",
                            newCategory
                        );
                        await loadCategories();
                        setNewCategory({ name: "", color: "#3b82f6" });
                    }}
                    onDelete={async (id) => {
                        await api.delete(
                            `/api/calendar/categories/${id}/`
                        );
                        await loadCategories();
                    }}
                    onClose={() => setIsCategoryModalOpen(false)}
                />
            </div>
        </AppBackground>
    );
}