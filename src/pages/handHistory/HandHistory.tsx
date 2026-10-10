import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    COSMOS_CONSTANTS,
    GameFormat,
    formatGameFormatDisplay,
    isTournamentFormat,
    type GameStateResponseDTO,
    type TexasHoldemStateDTO
} from "@block52/poker-vm-sdk";
import { useNetwork } from "../../context/NetworkContext";
import { getCosmosClient } from "../../utils/cosmos/client";
import { getCosmosAddress } from "../../utils/cosmos/storage";
import { convertGameList, type GameWithFormat } from "../../utils/convertUtils";
import { useFindGames } from "../../hooks/useFindGames";
import CopyButton from "../../components/copyButton/CopyButton";
import Dropdown from "../../components/dropdown/Dropdown";
import styles from "./HandHistory.module.css";

function shortId(gameId: string): string {
    return `${gameId.slice(0, 6)}…${gameId.slice(-4)}`;
}

function microToUsdc(micro: string): string {
    return (Number(micro) / Math.pow(10, COSMOS_CONSTANTS.USDC_DECIMALS)).toFixed(2);
}

function formatTimestamp(timestamp: number): string {
    // ActionDTO timestamps arrive as either seconds or milliseconds depending on source.
    const ms = timestamp > 1e12 ? timestamp : timestamp * 1000;
    return new Date(ms).toLocaleTimeString();
}

const HandHistory: React.FC = () => {
    const navigate = useNavigate();
    const { currentNetwork } = useNetwork();
    const { games: lobbyGames } = useFindGames();

    const cosmosAddress = getCosmosAddress();

    const [myGames, setMyGames] = useState<GameWithFormat[]>([]);
    const [pickerValue, setPickerValue] = useState("");
    const [freeTextId, setFreeTextId] = useState("");
    const [selectedGameId, setSelectedGameId] = useState("");
    const [gameState, setGameState] = useState<TexasHoldemStateDTO | null>(null);
    const [selectedFormat, setSelectedFormat] = useState<GameFormat | null>(null);
    const [isLoadingState, setIsLoadingState] = useState(false);
    const [stateError, setStateError] = useState("");

    useEffect(() => {
        if (!cosmosAddress) return;
        const load = async () => {
            try {
                const client = getCosmosClient(currentNetwork);
                if (!client) return;
                const games = await client.getPlayerGames(cosmosAddress);
                setMyGames(convertGameList(games));
            } catch {
                setMyGames([]);
            }
        };
        load();
    }, [cosmosAddress, currentNetwork]);

    const loadGameState = useCallback(
        async (gameId: string) => {
            const trimmed = gameId.trim();
            if (trimmed === "") return;
            setIsLoadingState(true);
            setStateError("");
            setGameState(null);
            setSelectedFormat(null);
            try {
                const client = getCosmosClient(currentNetwork);
                if (!client) throw new Error("Block52 client not initialized");
                // getGame (GET /game/{id}) is the spectator view: game_state/{id}
                // is the authenticated per-player endpoint and rejects anonymous reads.
                const response = await client.getGame(trimmed);
                if (!response.game || response.game === "null") {
                    throw new Error("Table not found on this network");
                }
                const parsed: GameStateResponseDTO = JSON.parse(response.game);
                setGameState(parsed.gameState);
                setSelectedFormat(parsed.format);
            } catch (err) {
                setStateError(err instanceof Error ? err.message : "Failed to load table state");
            } finally {
                setIsLoadingState(false);
            }
        },
        [currentNetwork]
    );

    const handlePickerChange = (gameId: string) => {
        setPickerValue(gameId);
        setSelectedGameId(gameId);
        if (gameId !== "") void loadGameState(gameId);
    };

    const handleFreeTextLoad = () => {
        setPickerValue("");
        setSelectedGameId(freeTextId.trim());
        void loadGameState(freeTextId);
    };

    // Sit & Go / tournament amounts are chips; cash amounts are micro-USDC.
    const isChipsGame =
        selectedFormat !== null && (selectedFormat === GameFormat.SIT_AND_GO || isTournamentFormat(selectedFormat));
    const formatAmount = (amount: string): string => (isChipsGame ? amount : `$${microToUsdc(amount)}`);

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <h1 className={styles.title}>Hand history</h1>
                <p className={styles.subtitle}>
                    Every action is logged on-chain. Pick a table to inspect its current hand — the chain exposes
                    the current hand&apos;s action log.
                </p>
            </div>

            {cosmosAddress && (
                <div className={`pane-lite ${styles.panel}`}>
                    <div className={styles.panelHeader}>
                        <span className="section-label">My tables</span>
                        <span className={styles.count}>{myGames.length}</span>
                    </div>
                    {myGames.length === 0 ? (
                        <div className={styles.stateBox}>
                            <p className={styles.stateText}>No tables found for your wallet on this network.</p>
                        </div>
                    ) : (
                        myGames.map(game => (
                            <div
                                key={game.gameId}
                                className={`row-hover ${styles.myGameRow}`}
                                onClick={() => navigate(`/table/${game.gameId}`)}
                            >
                                <div className={styles.myGameIdentity}>
                                    <span className={styles.myGameName}>{game.name ?? shortId(game.gameId)}</span>
                                    <span className={styles.myGameId}>
                                        {shortId(game.gameId)}
                                        <CopyButton text={game.gameId} message="Table ID copied" title="Copy table ID" />
                                    </span>
                                </div>
                                <span className={styles.mutedCell}>{formatGameFormatDisplay(game.gameFormat)}</span>
                                <span className={styles.mutedCell}>
                                    {game.currentPlayers} / {game.maxPlayers} players
                                </span>
                                {isTournamentFormat(game.gameFormat) && (
                                    <span className={styles.sngNote}>S&amp;G</span>
                                )}
                            </div>
                        ))
                    )}
                </div>
            )}

            <div className={`pane-lite ${styles.pickerCard}`}>
                <span className="section-label">Select table</span>
                <div className={styles.pickerRow}>
                    <Dropdown
                        className={styles.pickerDropdown}
                        value={pickerValue}
                        onSelect={handlePickerChange}
                        placeholder="Choose a live table…"
                        options={lobbyGames.map(game => ({
                            value: game.gameId,
                            label: `${game.name ?? shortId(game.gameId)} — ${formatGameFormatDisplay(game.gameFormat)}`
                        }))}
                    />
                    <span className={styles.pickerOr}>or</span>
                    <input
                        type="text"
                        value={freeTextId}
                        onChange={e => setFreeTextId(e.target.value)}
                        placeholder="Enter table ID"
                        className={styles.input}
                        onKeyDown={e => {
                            if (e.key === "Enter") handleFreeTextLoad();
                        }}
                    />
                    <button
                        className={`btn-ghost ${styles.ghostButton}`}
                        onClick={handleFreeTextLoad}
                        disabled={freeTextId.trim() === ""}
                    >
                        Load
                    </button>
                </div>
            </div>

            {isLoadingState && (
                <div className={`pane-lite ${styles.panel}`}>
                    <div className={styles.stateBox}>
                        <div className={styles.spinner} />
                        <p className={styles.stateText}>Loading table state…</p>
                    </div>
                </div>
            )}

            {stateError && (
                <div className={`pane-lite ${styles.panel}`}>
                    <div className={styles.stateBox}>
                        <p className={styles.stateTitle}>Failed to load table</p>
                        <p className={styles.stateText}>{stateError}</p>
                    </div>
                </div>
            )}

            {gameState && (
                <>
                    <div className={`pane-lite ${styles.panel}`}>
                        <div className={styles.panelHeader}>
                            <span className="section-label">Current hand</span>
                            <span className={styles.monoMuted}>{shortId(selectedGameId)}</span>
                        </div>
                        <div className={styles.statRow}>
                            <div className={styles.stat}>
                                <span className={styles.statValue}>{gameState.handNumber}</span>
                                <span className={styles.statLabel}>Hand</span>
                            </div>
                            <div className={styles.stat}>
                                <span className={styles.statValue}>{gameState.round}</span>
                                <span className={styles.statLabel}>Round</span>
                            </div>
                            <div className={styles.stat}>
                                <span className={styles.statValue}>{formatAmount(gameState.totalPot)}</span>
                                <span className={styles.statLabel}>Total pot</span>
                            </div>
                            <div className={styles.stat}>
                                <span className={styles.statValueMono}>
                                    {gameState.communityCards.length > 0 ? gameState.communityCards.join(" ") : "—"}
                                </span>
                                <span className={styles.statLabel}>Board</span>
                            </div>
                        </div>
                        {gameState.winners.length > 0 && (
                            <div className={styles.winnersBox}>
                                <span className="section-label">Winners</span>
                                {gameState.winners.map((winner, i) => (
                                    <div key={i} className={styles.winnerRow}>
                                        <span className={styles.winnerSeat}>Seat {winner.seat}</span>
                                        <span className={styles.winnerAddress}>
                                        {shortId(winner.address)}
                                        <CopyButton text={winner.address} message="Address copied" title="Copy address" />
                                    </span>
                                        <span className={styles.winnerAmount}>+{formatAmount(winner.amount)}</span>
                                        {winner.description && (
                                            <span className={styles.mutedCell}>{winner.description}</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className={`pane-lite ${styles.panel}`}>
                        <div className={styles.panelHeader}>
                            <span className="section-label">Action log</span>
                            <span className={styles.count}>{gameState.previousActions.length}</span>
                        </div>
                        {gameState.previousActions.length === 0 ? (
                            <div className={styles.stateBox}>
                                <p className={styles.stateText}>No actions recorded for the current hand.</p>
                            </div>
                        ) : (
                            <>
                                <div className={styles.logHeader}>
                                    <span className="section-label">#</span>
                                    <span className="section-label">Seat</span>
                                    <span className="section-label">Action</span>
                                    <span className="section-label">Amount</span>
                                    <span className="section-label">Round</span>
                                    <span className="section-label">Time</span>
                                </div>
                                {gameState.previousActions.map(action => (
                                    <div key={action.index} className={styles.logRow}>
                                        <span className={styles.monoMuted}>{action.index}</span>
                                        <span className={styles.cell}>{action.seat}</span>
                                        <span className={styles.actionCell}>{action.action}</span>
                                        <span className={styles.cell}>
                                            {Number(action.amount) > 0 ? formatAmount(action.amount) : "—"}
                                        </span>
                                        <span className={styles.mutedCell}>{action.round}</span>
                                        <span className={styles.monoMuted}>{formatTimestamp(action.timestamp)}</span>
                                    </div>
                                ))}
                            </>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default HandHistory;
