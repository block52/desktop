import { createRoot } from "react-dom/client";
import { AppKitProvider } from "./providers/AppKitProvider";
import { NetworkProvider } from "./context/NetworkContext";
import { ToastProvider } from "./context/ToastContext";
import { GameStateProvider } from "./context/GameStateContext";
import Router from "./router";

const root = createRoot(document.body);
root.render(
    <AppKitProvider>
        <NetworkProvider>
            <ToastProvider>
                <GameStateProvider>
                    <Router />
                </GameStateProvider>
            </ToastProvider>
        </NetworkProvider>
    </AppKitProvider>
);
