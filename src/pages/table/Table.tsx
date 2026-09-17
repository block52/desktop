import React, { useEffect } from "react";
import { useParams } from "react-router-dom";
import { useGameState } from "../../context/GameStateContext";

const Table: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { gameState, isLoading, error, validationError, latestEvents, subscribeToTable, unsubscribeFromTable } = useGameState();

    useEffect(() => {
        if (!id) {
            return;
        }
        subscribeToTable(id);
        return () => {
            unsubscribeFromTable();
        };
    }, [id, subscribeToTable, unsubscribeFromTable]);

    return (
        <div style={{ padding: 16, fontFamily: "monospace", color: "#fff" }}>
            <h1>Table {id}</h1>
            {isLoading && <p>Connecting…</p>}
            {error && <p style={{ color: "#ef4444" }}>Error: {error.message}</p>}
            {validationError && <p style={{ color: "#f59e0b" }}>Validation: {validationError.message}</p>}
            <h2>Latest events ({latestEvents.length})</h2>
            <pre style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>{JSON.stringify(latestEvents, null, 2)}</pre>
            <h2>Raw game state</h2>
            <pre style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>{gameState ? JSON.stringify(gameState, null, 2) : "(no state yet)"}</pre>
        </div>
    );
};

export default Table;
