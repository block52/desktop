import { useCallback } from "react";
import { useToast } from "../context/ToastContext";
import { copyText } from "../utils/clipboard";

export function useCopyToClipboard(): (text: string, successMessage?: string) => Promise<boolean> {
    const { showSuccess, showError } = useToast();

    return useCallback(
        async (text: string, successMessage = "Copied to clipboard") => {
            const ok = await copyText(text);
            if (ok) {
                showSuccess(successMessage);
            } else {
                showError("Failed to copy");
            }
            return ok;
        },
        [showSuccess, showError]
    );
}
