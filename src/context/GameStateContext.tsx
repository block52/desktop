import React, { createContext, useContext, useCallback, useEffect, useRef, useState } from "react";
import type { TexasHoldemStateDTO, GameFormat, GameVariant } from "@block52/poker-vm-sdk";
import { useNetwork } from "./NetworkContext";
import { getCosmosAddress } from "../utils/cosmos/storage";
import { createAuthPayload } from "../utils/cosmos/signing";
import { GameMessageBus } from "../bus/GameMessageBus";
import type { RawWsMessage } from "../bus/ingest";
import type { ValidationError, PendingAction, GameEvent } from "../bus/types";

export interface GameStateValue {
    gameState: TexasHoldemStateDTO | undefined;
    gameFormat: GameFormat | undefined;
    gameVariant: GameVariant | undefined;
    gameName: string | undefined;
    isLoading: boolean;
    error: Error | null;
    validationError: ValidationError | null;
    pendingAction: PendingAction | null;
    latestEvents: GameEvent[];
    subscribeToTable: (tableId: string) => void;
    unsubscribeFromTable: () => void;
    getLatestSnapshot: () => TexasHoldemStateDTO | undefined;
}

const GameStateContext = createContext<GameStateValue | null>(null);

interface GameStateProviderProps {
    children: React.ReactNode;
}

export const GameStateProvider: React.FC<GameStateProviderProps> = ({ children }) => {
    const [gameState, setGameState] = useState<TexasHoldemStateDTO | undefined>(undefined);
    const [gameFormat, setGameFormat] = useState<GameFormat | undefined>(undefined);
    const [gameVariant, setGameVariant] = useState<GameVariant | undefined>(undefined);
    const [gameName, setGameName] = useState<string | undefined>(undefined);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<Error | null>(null);
    const [validationError, setValidationError] = useState<ValidationError | null>(null);
    const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
    const [latestEvents, setLatestEvents] = useState<GameEvent[]>([]);

    const { currentNetwork } = useNetwork();

    const currentTableIdRef = useRef<string | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const hasReceivedMessageRef = useRef<boolean>(false);
    const fallbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const busRef = useRef<GameMessageBus | null>(null);
    const generationRef = useRef(0);
    if (busRef.current === null) {
        busRef.current = new GameMessageBus();
    }

    const subscribeToTable = useCallback(
        (tableId: string) => {
            if (currentTableIdRef.current === tableId && wsRef.current?.readyState === WebSocket.OPEN) {
                return;
            }
            if (currentTableIdRef.current === tableId && wsRef.current?.readyState === WebSocket.CONNECTING) {
                return;
            }
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }

            const generation = ++generationRef.current;

            setIsLoading(true);
            setError(null);
            setValidationError(null);
            currentTableIdRef.current = tableId;
            hasReceivedMessageRef.current = false;

            busRef.current?.reset();
            setLatestEvents([]);

            if (fallbackTimeoutRef.current) {
                clearTimeout(fallbackTimeoutRef.current);
                fallbackTimeoutRef.current = null;
            }

            const playerAddress = getCosmosAddress();
            if (!playerAddress) {
                setError(new Error("No Block52 wallet address found. Please connect your wallet."));
                setIsLoading(false);
                return;
            }

            if (!currentNetwork.ws) {
                console.error("[GameStateContext] Network missing WebSocket endpoint");
                setError(new Error("Network configuration missing WebSocket endpoint"));
                setIsLoading(false);
                return;
            }

            const fullWsUrl = `${currentNetwork.ws}?tableAddress=${tableId}&playerId=${playerAddress}`;
            const ws = new WebSocket(fullWsUrl);
            wsRef.current = ws;

            ws.onopen = async () => {
                const authPayload = await createAuthPayload();

                if (wsRef.current !== ws || ws.readyState !== WebSocket.OPEN || generationRef.current !== generation) {
                    return;
                }

                const subscriptionMessage = {
                    type: "subscribe",
                    gameId: tableId,
                    playerAddress: authPayload?.playerAddress ?? playerAddress,
                    timestamp: authPayload?.timestamp,
                    signature: authPayload?.signature,
                };

                ws.send(JSON.stringify(subscriptionMessage));
                setIsLoading(false);

                fallbackTimeoutRef.current = setTimeout(() => {
                    if (generationRef.current !== generation) {
                        return;
                    }
                    if (!hasReceivedMessageRef.current && currentTableIdRef.current === tableId) {
                        console.error("[GameStateContext] WebSocket server did not respond within 5 seconds");
                        setError(
                            new Error(
                                "WebSocket server not responding. The game server may be offline or not broadcasting game state. " +
                                    "Please try refreshing or contact support if the issue persists."
                            )
                        );
                        setIsLoading(false);
                    }
                }, 5000);
            };

            ws.onmessage = event => {
                if (generationRef.current !== generation) {
                    return;
                }

                let message: RawWsMessage;
                try {
                    message = JSON.parse(event.data);
                } catch (err) {
                    console.error("[GameStateContext] Failed to parse WebSocket message:", (err as Error).message);
                    setError(new Error("Error parsing WebSocket message"));
                    return;
                }

                hasReceivedMessageRef.current = true;

                const item = busRef.current?.ingest(message, tableId);
                if (!item) {
                    return;
                }

                switch (item.classified.kind) {
                    case "state": {
                        setLatestEvents(item.events);
                        setGameState(item.classified.snapshot);
                        setGameFormat(item.classified.format);
                        setGameVariant(item.classified.variant);
                        setGameName(item.classified.name);
                        setPendingAction(null);
                        if (item.classified.validationError) {
                            setValidationError(item.classified.validationError);
                        } else {
                            setError(null);
                            setValidationError(null);
                        }
                        break;
                    }
                    case "validationErrorNoState": {
                        setValidationError(item.classified.validationError);
                        break;
                    }
                    case "pending": {
                        setPendingAction(item.classified.pendingAction);
                        break;
                    }
                    case "actionAccepted": {
                        break;
                    }
                    case "error": {
                        setError(item.classified.error);
                        setIsLoading(false);
                        setPendingAction(null);
                        if (item.classified.clearGameState) {
                            setGameState(undefined);
                        }
                        break;
                    }
                    default:
                        break;
                }
            };

            ws.onclose = () => {
                if (wsRef.current === ws) {
                    wsRef.current = null;
                }
            };

            ws.onerror = wsError => {
                if (generationRef.current !== generation) {
                    return;
                }
                console.error("WebSocket error:", wsError);
                setError(new Error(`WebSocket connection error for table ${tableId}`));
                setIsLoading(false);
            };
        },
        [currentNetwork]
    );

    const unsubscribeFromTable = useCallback(() => {
        generationRef.current += 1;
        if (fallbackTimeoutRef.current) {
            clearTimeout(fallbackTimeoutRef.current);
            fallbackTimeoutRef.current = null;
        }
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
        currentTableIdRef.current = null;
        hasReceivedMessageRef.current = false;
        busRef.current?.reset();
        setLatestEvents([]);
        setGameState(undefined);
        setGameFormat(undefined);
        setGameVariant(undefined);
        setGameName(undefined);
        setIsLoading(false);
        setError(null);
        setValidationError(null);
        setPendingAction(null);
    }, []);

    const getLatestSnapshot = useCallback((): TexasHoldemStateDTO | undefined => {
        return busRef.current?.getLastSnapshot();
    }, []);

    useEffect(() => {
        return () => {
            generationRef.current += 1;
            if (fallbackTimeoutRef.current) {
                clearTimeout(fallbackTimeoutRef.current);
            }
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, []);

    return (
        <GameStateContext.Provider
            value={{
                gameState,
                gameFormat,
                gameVariant,
                gameName,
                isLoading,
                error,
                validationError,
                pendingAction,
                latestEvents,
                subscribeToTable,
                unsubscribeFromTable,
                getLatestSnapshot,
            }}
        >
            {children}
        </GameStateContext.Provider>
    );
};

export const useGameState = (): GameStateValue => {
    const context = useContext(GameStateContext);
    if (!context) {
        throw new Error("useGameState must be used within a GameStateProvider");
    }
    return context;
};
