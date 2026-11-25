import React from "react";
import { useNavigate } from "react-router-dom";
import type { TournamentStateDTO } from "@block52/poker-vm-sdk";
import { useTournaments } from "../../hooks/useTournaments";
import { useTournament } from "../../hooks/useTournament";
import { entrantCount, startLabel, totalCost, tournamentIdOf, tournamentStatusLabel } from "../../utils/tournaments";
import tableStyles from "./TableList.module.css";
import styles from "./TournamentList.module.css";

/** A tournament matches by id or by status word ("registering", "running"…). */
function matches(tournament: TournamentStateDTO, query: string): boolean {
    const q = query.trim().toLowerCase();
    return q === "" || tournament.tournamentId.toLowerCase().includes(q) || tournament.status.includes(q);
}

export const TournamentRow: React.FC<{ tournament: TournamentStateDTO }> = ({ tournament }) => {
    const navigate = useNavigate();
    const { options } = tournament;
    const open = () => navigate(`/tournament/${tournament.tournamentId}`);
    return (
        <div className={`row-hover ${styles.row}`} role="link" tabIndex={0} onClick={open} onKeyDown={event => event.key === "Enter" && open()}>
            <div className={styles.identity}>
                <span className={styles.id}>{tournament.tournamentId}</span>
                <span className={styles.sub}>{options.seatsPerTable}-handed · starts {startLabel(options.startTime)}</span>
            </div>
            <span className={`${styles.badge} ${tournament.status === "registering" ? styles.registering : tournament.status === "running" ? styles.running : ""}`}>
                {tournamentStatusLabel(tournament.status)}
            </span>
            <span>
                {entrantCount(tournament)} / {options.maxEntrants} entrants <span className={styles.sub}>(min {options.minEntrants})</span>
            </span>
            <span>${totalCost(options)}</span>
            <button type="button" className={`btn-ghost btn-pill ${styles.action}`} onClick={event => { event.stopPropagation(); open(); }}>
                {tournament.status === "registering" ? "Register" : "View"}
            </button>
        </div>
    );
};

/** A pasted tournament id (or one of its table ids) that no listed tournament matched: ask the chain for it. */
export const TournamentLookupHint: React.FC<{ id: string }> = ({ id }) => {
    const { tournament, isLoading } = useTournament(id);
    if (isLoading) return <div className={tableStyles.stateBox}><p className={tableStyles.stateText}>Looking for that tournament…</p></div>;
    if (tournament === null) {
        return (
            <div className={tableStyles.stateBox}>
                <p className={tableStyles.stateTitle}>No tournament with that id</p>
                <p className={tableStyles.stateText}>Check the id, or the network you are connected to.</p>
            </div>
        );
    }
    return <TournamentRow tournament={tournament} />;
};

interface TournamentListProps {
    search: string;
}

/** The lobby's Tournaments tab: multi-table tournaments, newest first within each status. */
const TournamentList: React.FC<TournamentListProps> = ({ search }) => {
    const { tournaments, isLoading, error, refetch } = useTournaments();
    const shown = tournaments.filter(tournament => matches(tournament, search));
    const pastedId = tournamentIdOf(search);

    let body: React.ReactNode;
    if (isLoading) {
        body = <div className={tableStyles.stateBox}><div className={tableStyles.spinner} /><p className={tableStyles.stateTitle}>Loading tournaments…</p></div>;
    } else if (error !== "" && shown.length === 0) {
        body = (
            <div className={tableStyles.stateBox}>
                <p className={tableStyles.stateTitle}>Failed to load tournaments</p>
                <p className={tableStyles.stateText}>{error}</p>
                <button type="button" onClick={() => void refetch()} className={tableStyles.retryBtn}>Retry</button>
            </div>
        );
    } else if (shown.length > 0) {
        body = shown.map(tournament => <TournamentRow key={tournament.tournamentId} tournament={tournament} />);
    } else if (pastedId !== null) {
        body = <TournamentLookupHint id={pastedId} />;
    } else {
        body = <div className={tableStyles.stateBox}><p className={tableStyles.stateTitle}>No tournaments</p><p className={tableStyles.stateText}>{search.trim() === "" ? "None have been created yet." : "None match your search."}</p></div>;
    }

    return (
        <div className={`pane-lite ${tableStyles.panel}`}>
            <div className={`${styles.row} ${styles.head}`}>
                <span className="section-label">Tournament</span>
                <span className="section-label">Status</span>
                <span className="section-label">Entrants</span>
                <span className="section-label">Cost</span>
                <span />
            </div>
            {body}
        </div>
    );
};

export default TournamentList;
