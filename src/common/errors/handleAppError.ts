import { useNavigate } from "react-router-dom";
import type { AppError } from "./errorTypes";

export function handleAppError(
    error: AppError,
    navigate: ReturnType<typeof useNavigate>
) {
    switch (error.action) {
        case "SHOW_ALERT":
            alert(error.message);
            break;

        case "REDIRECT_LOGIN":
            alert("Session expired. Please log in again.");
            navigate("/login");
            break;

        case "LOGOUT":
            navigate("/login");
            break;

        case "RETRY":
            alert("Temporary error. Please try again.");
            break;

        case "IGNORE":
            break;

        default:
            alert(error.message);
    }
}