import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CopyButton, useToast } from "@block52/ui-sdk";
import { useNetwork } from "../../context/NetworkContext";
import { useTournament } from "../../hooks/useTournament";
import { getCosmosAddress } from "../../utils/cosmos/storage";
import { getSigningClient } from "../../utils/cosmos/client";
import { blindLines, entrantCount, isRegistered, mySeat, startLabel, totalCost, tournamentIdOf, tournamentStatusLabel, usdc } from "../../utils/tournaments";
import styles from "./Tournament.module.css";

const POLL_MS = 10_000;
const LEVELS_SHOWN = 4;

const Fact: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className={styles.fact}>
        <span className={styles.factLabel}>{label}</span>
        <span className={styles.factValue}>{value}</span>
    </div>
);

/** One multi-table tournament: its terms, who is in, its tables once it runs, and registration while it is open. */
const Tournament: React.FC = () => {
    const { id } = useParams();
    const tournamentId = tournamentIdOf(id ?? "");
    const navigate = useNavigate();
    const { currentNetwork } = useNetwork();
    const { showSuccess, showError } = useToast();
    const { tournament, isLoading, error, refetch } = useTournament(tournamentId, POLL_MS);
    const [isRegistering, setIsRegistering] = useState(false);
    const [registerError, setRegisterError] = useState("");
    const me = getCosmosAddress();

    if (tournamentId === null) return <p className={styles.note}>That is not a tournament id.</p>;
    if (isLoading) return <p className={styles.note}>Loading the tournament…</p>;
    if (tournament === null) {
        return <p className={error === "" ? styles.note : styles.error}>{error === "" ? "No tournament with that id on this network." : error}</p>;
    }

    const { options } = tournament;
    const blinds = blindLines(options);
    const registered = isRegistered(tournament, me);
    const seat = mySeat(tournament, me);
    const myTableId = seat !== null && seat.status === "playing" ? seat.tableId : null;
    const canRegister = tournament.status === "registering" && !registered && entrantCount(tournament) < options.maxEntrants;

    const register = async () => {
        setIsRegistering(true);
        setRegisterError("");
        try {
            const { signingClient } = await getSigningClient(currentNetwork);
            await signingClient.registerTournament(tournament.tournamentId);
            showSuccess("Registered for the tournament");
            await refetch();
        } catch (err) {
            const message = (err instanceof Error ? err.message : "Registration failed").replace(/^Error invoking remote method '[^']*': (Error: )?/, "");
            setRegisterError(message);
            showError(message);
        } finally {
            setIsRegistering(false);
        }
    };

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <h2 className={styles.title}>Tournament</h2>
                <span className={styles.factValue}>{tournamentStatusLabel(tournament.status)}</span>
            </div>
            <div className={styles.header}>
                <span className={styles.id}>{tournament.tournamentId}</span>
                <CopyButton text={tournament.tournamentId} message="Tournament ID copied" title="Copy tournament ID" />
            </div>

            {seat !== null && myTableId !== null && (
                <div className={`pane-lite ${styles.seated}`}>
                    <div className={styles.seatedText}>
                        <span className={styles.seatedTitle}>You are seated</span>
                        <span>
                            {seat.ordinal !== null ? `Table ${seat.ordinal}` : "Your table"}
                            {seat.seat !== null ? `, seat ${seat.seat}` : ""} · stack {seat.stack}
                        </span>
                    </div>
                    <button type="button" className="btn-glow" onClick={() => navigate(`/table/${myTableId}`)}>
                        Go to your table
                    </button>
                </div>
            )}
            {seat !== null && seat.status === "busted" && <p className={styles.note}>You were eliminated from this tournament.</p>}

            <div className={styles.grid}>
                <Fact label="Starts" value={startLabel(options.startTime)} />
                <Fact label="Entrants" value={`${entrantCount(tournament)} / ${options.maxEntrants} (min ${options.minEntrants})`} />
                <Fact label="Buy-in" value={`$${usdc(options.buyIn)} + $${usdc(options.entryFee)} fee`} />
                <Fact label="Starting stack" value={options.startingStack} />
                <Fact label="Seats per table" value={String(options.seatsPerTable)} />
                <Fact label="Prize pool" value={`$${usdc(tournament.prizePool)}`} />
            </div>

            {tournament.status === "registering" && (
                <div className={`pane-lite ${styles.section}`}>
                    <div className={styles.actions}>
                        <button type="button" className="btn-glow" disabled={!canRegister || isRegistering || me === null} onClick={() => void register()}>
                            {isRegistering ? "Registering…" : registered ? "You are registered" : `Register for $${totalCost(options)}`}
                        </button>
                        {me === null && <span className={styles.note}>Create or import a wallet to register.</span>}
                    </div>
                    {registerError !== "" && <p className={styles.error}>{registerError}</p>}
                    <p className={styles.note}>The tournament starts at its start time once the minimum number of players has registered.</p>
                </div>
            )}

            {blinds.length > 0 && (
                <div className={`pane-lite ${styles.section}`}>
                    <span className="section-label">Blinds</span>
                    {blinds.slice(0, LEVELS_SHOWN).map(line => (
                        <div key={line.key} className={styles.line}>
                            <span>{line.label}</span>
                            <span>{line.text}</span>
                        </div>
                    ))}
                    {blinds.length > LEVELS_SHOWN && <p className={styles.note}>and {blinds.length - LEVELS_SHOWN} more levels</p>}
                </div>
            )}

            {tournament.tables.length > 0 && (
                <div className={`pane-lite ${styles.section}`}>
                    <span className="section-label">Tables</span>
                    {tournament.tables.filter(table => !table.broken).map(table => (
                        <div key={table.tableId} className={table.tableId === myTableId ? `${styles.line} ${styles.mine}` : styles.line}>
                            <button type="button" className={styles.link} onClick={() => navigate(`/table/${table.tableId}`)}>
                                Table {table.ordinal}
                            </button>
                            <span>
                                {table.tableId === myTableId && seat !== null && <strong className={styles.hereBadge}>You are here{seat.seat !== null ? ` · seat ${seat.seat}` : ""}</strong>}
                                {table.players.length} players
                            </span>
                        </div>
                    ))}
                </div>
            )}

            <div className={`pane-lite ${styles.section}`}>
                <span className="section-label">Entrants ({entrantCount(tournament)})</span>
                {tournament.entrants.length === 0 && <p className={styles.note}>Nobody has registered yet.</p>}
                {tournament.entrants.map(entrant => (
                    <div key={entrant.address} className={me !== null && entrant.address.toLowerCase() === me.toLowerCase() ? `${styles.line} ${styles.mine}` : styles.line}>
                        <span className={styles.address}>
                            <button type="button" className={`${styles.link} ${styles.mono}`} title="Open this player's profile" onClick={() => navigate(`/players/${entrant.address}`)}>
                                {entrant.address}
                            </button>
                            {me !== null && entrant.address.toLowerCase() === me.toLowerCase() && " (you)"}
                        </span>
                        <span>
                            {entrant.status === "playing" && entrant.tableId !== undefined && entrant.tableId !== ""
                                ? `${tournament.tables.find(table => table.tableId === entrant.tableId)?.ordinal !== undefined ? `Table ${tournament.tables.find(table => table.tableId === entrant.tableId)?.ordinal}` : "Seated"}${entrant.seat !== undefined ? `, seat ${entrant.seat}` : ""}`
                                : entrant.status}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Tournament;
