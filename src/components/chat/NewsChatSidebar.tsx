import { useState, useEffect } from "react";
import { MessageCircle, X } from "lucide-react";
import type { NewsItem } from "@/api/types";
import ChatBody from "@/components/chat/ChatBody";
import Button from "@/components/ui/Button";

type Props = {
    news: NewsItem[];
};

export default function NewsChatSidebar({ news }: Props) {
    const [open, setOpen] = useState(false);

    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setOpen(false);
            }
        };

        window.addEventListener("keydown", handleEsc);
        return () => window.removeEventListener("keydown", handleEsc);
    }, []);

    return (
        <>
            {!open && (
                <Button
                    onClick={() => setOpen(true)}
                    size="sm"
                    className="fixed right-6 bottom-6 z-[9999] rounded-full shadow-xl p-4"
                >
                    <MessageCircle size={20} />
                </Button>
            )}

            <div
                className={`
                    fixed top-0 right-0 h-full w-full sm:w-96
                    bg-white border-l border-gray-200
                    shadow-2xl
                    transform transition-transform duration-300 ease-in-out
                    z-[9999]
                    ${open ? "translate-x-0" : "translate-x-full"}
                `}
            >
                <div className="flex items-center justify-between p-4 border-b bg-gray-50">
                    <span className="font-semibold text-gray-800">
                        Hackonomics Assistant
                    </span>

                    <Button
                        onClick={() => setOpen(false)}
                        variant="secondary"
                        size="sm"
                    >
                        <X size={18} />
                    </Button>
                </div>

                <div className="flex flex-col h-[calc(100%-64px)]">
                    <ChatBody news={news} />
                </div>
            </div>
        </>
    );
}