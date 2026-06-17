import type { NewsItem } from "@/api/types";

type StreamPayload = {
    question: string;
    news: NewsItem[];
};

export async function streamChat(
    payload: StreamPayload,
    onChunk: (chunk: string) => void,
    signal?: AbortSignal
) {

    const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/news/chat/stream/`,
        {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
            signal,
        }
    );

    if (!response.ok || !response.body) {
        throw new Error("Failed to connect to chat stream");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");

    let buffer = "";

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
            const trimmed = line.trim();
            // ignore keepalive
            if (!trimmed || trimmed.startsWith(":")) continue;
            // SSE data
            if (trimmed.startsWith("data:")) {
                const chunk = trimmed.slice(5).trimStart();
                if (chunk === "done") return;
                onChunk(chunk);
            }
        }
    }
}