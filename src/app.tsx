import React from "react";
import { createRoot } from "react-dom/client";
import { AppKitProvider } from "./providers/AppKitProvider";
import { NetworkProvider } from "./context/NetworkContext";
import { ToastProvider } from "./context/ToastContext";
import Router from "./router";

const root = createRoot(document.body);
root.render(
    <AppKitProvider>
        <NetworkProvider>
            <ToastProvider>
                <Router />
            </ToastProvider>
        </NetworkProvider>
    </AppKitProvider>
);
