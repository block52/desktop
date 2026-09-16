import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import ToastList from "../components/toast/Toast";

export interface ToastItem {
    id: number;
    message: string;
    type: "success" | "error" | "warning" | "info";
    hiding: boolean;
}

interface ToastContextValue {
    showToast: (message: string, type?: ToastItem["type"]) => void;
    showSuccess: (message: string) => void;
    showError: (message: string) => void;
    showWarning: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<ToastItem[]>([]);
    const nextId = useRef(0);

    const showToast = useCallback((message: string, type: ToastItem["type"] = "success") => {
        const id = nextId.current++;

        setToasts(prev => [...prev, { id, message, type, hiding: false }]);

        // Begin fade-out after 2.5 s
        setTimeout(() => {
            setToasts(prev => prev.map(t => t.id === id ? { ...t, hiding: true } : t));
            // Remove from DOM after animation (200 ms)
            setTimeout(() => {
                setToasts(prev => prev.filter(t => t.id !== id));
            }, 200);
        }, 2500);
    }, []);

    const showSuccess = useCallback((m: string) => showToast(m, "success"), [showToast]);
    const showError   = useCallback((m: string) => showToast(m, "error"),   [showToast]);
    const showWarning = useCallback((m: string) => showToast(m, "warning"), [showToast]);

    return (
        <ToastContext.Provider value={{ showToast, showSuccess, showError, showWarning }}>
            {children}
            <ToastList toasts={toasts} />
        </ToastContext.Provider>
    );
};

export const useToast = (): ToastContextValue => {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error("useToast must be used inside ToastProvider");
    return ctx;
};
