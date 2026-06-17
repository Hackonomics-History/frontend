import axios from "axios"
import { createAppError } from "@/common/errors/createAppError";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        "Content-Type": "application/json",
    },
    withCredentials: true,
});

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        const isAuthEndpoint =
            originalRequest.url?.includes("/bff/login") ||
            originalRequest.url?.includes("/bff/whoami") ||
            originalRequest.url?.includes("/auth/signup");

        if (error.response?.status === 401 &&
            !originalRequest._retry &&
            !isAuthEndpoint
        ) {
            originalRequest._retry = true;

            try {
                await axios.get(
                    `${API_BASE_URL}/bff/whoami`,
                    { withCredentials: true }
                );

                return api(originalRequest);
            } catch (refreshError) {
                return Promise.reject(createAppError(refreshError));
            }
        }
        return Promise.reject(createAppError(error));
    }
);