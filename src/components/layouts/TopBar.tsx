import { useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/useAuth";
import { api } from "@/api/client";
import { Home, LogOut, User, Calendar, Newspaper } from "lucide-react";
import Button from "@/components/ui/Button";

export default function TopBar() {
    const navigate = useNavigate();
    const { logout } = useAuth();

    const handleGoHome = () => {
        navigate("/home");
    };

    const handleGoCalendar = () => {
        navigate("/calendar");
    }

    const handleGoNews = () => {
        navigate("/news");
    }

    const handleGoMyPage = () => {
        navigate("/me");
    };

    const handleLogout = async () => {
        try {
            const csrfToken = document.cookie
                .split("; ")
                .find((row) => row.startsWith("__csrf="))
                ?.split("=")[1] ?? "";
            await api.post("/bff/logout", {}, {
                withCredentials: true,
                headers: { "X-CSRF-Token": csrfToken },
            });
        } finally {
            logout();
            navigate("/login");
        }
    };

    return (
        <div className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-black/10">
            <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Button onClick={handleGoHome} variant="secondary" size="sm">
                        <Home size={16} />
                        <span>Home</span>
                    </Button>

                    <Button onClick={handleGoCalendar} variant="secondary" size="sm">
                        <Calendar size={16} />
                        <span>Calendar</span>
                    </Button>

                    <Button onClick={handleGoNews} variant="secondary" size="sm">
                        <Newspaper size={16} />
                        <span>News</span>
                    </Button>
                </div>

                <div className="flex items-center gap-2">
                    <Button onClick={handleGoMyPage} variant="secondary" size="sm">
                        <User size={16} />
                        <span>MyPage</span>
                    </Button>

                    <Button onClick={handleLogout} variant="secondary" size="sm">
                        <LogOut size={16} />
                        <span>Logout</span>
                    </Button>
                </div>
            </div>
        </div>
    );
}