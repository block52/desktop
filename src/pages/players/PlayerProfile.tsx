import React from "react";
import { Link, useParams } from "react-router-dom";
import { usePlayerProfile } from "../../hooks/usePlayerProfile";
import { formatMicroUsd } from "../../utils/currency";
import CopyButton from "../../components/copyButton/CopyButton";
import { playerInitials } from "./Players";
import styles from "./Players.module.css";

/** Indexer percentage fields are integers scaled x100 (2550 = 25.5%). */
function scaledPercent(value: number): string {
    return `${(value / 100).toFixed(1)}%`;
}

interface Tile {
    label: string;
    value: string;
    note: string;
    tone?: "pos" | "neg";
}

const PlayerProfile: React.FC<{ address: string }> = ({ address }) => {
    const { profile, sessions, sessionsTotal, isLoading, error } = usePlayerProfile(address);

    const tiles: Tile[] =
        profile === null
            ? []
            : [
                  { label: "Hands", value: profile.total_hands.toLocaleString(), note: `${profile.total_actions.toLocaleString()} actions` },
                  {
                      label: "Net",
                      value: `${profile.net_profit > 0 ? "+" : ""}${formatMicroUsd(profile.net_profit)}`,
                      note: `${formatMicroUsd(profile.total_buy_ins)} in · ${formatMicroUsd(profile.total_cash_outs)} out`,
                      tone: profile.net_profit >= 0 ? "pos" : "neg"
                  },
                  { label: "VPIP", value: scaledPercent(profile.vpip), note: "Voluntarily in pot" },
                  { label: "PFR", value: scaledPercent(profile.pfr), note: "Preflop raise" },
                  { label: "Aggression", value: (profile.aggression_factor / 100).toFixed(2), note: "Bets + raises / calls" },
                  { label: "WTSD", value: scaledPercent(profile.wtsd), note: "Went to showdown" },
                  { label: "Sessions", value: profile.session_count.toLocaleString(), note: `Longest ${profile.longest_session_blocks.toLocaleString()} blocks` },
                  { label: "Biggest pot", value: formatMicroUsd(profile.biggest_pot_won), note: "Won in a single hand" },
                  { label: "Rake", value: formatMicroUsd(profile.total_rake_contributed), note: `${profile.vip_points.toLocaleString()} VIP points` }
              ];

    return (
        <div className={styles.page}>
            <Link to="/players" className={`btn-ghost ${styles.back}`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="m15 18-6-6 6-6" />
                </svg>
                Players
            </Link>

            <div className={styles.identity}>
                <div className={`${styles.avatar} ${styles.avatarLg}`}>{playerInitials(address)}</div>
                <div className={styles.identityText}>
                    <h1 className={styles.title}>{`${address.slice(0, 10)}…${address.slice(-6)}`}</h1>
                    <span className={styles.fullAddress}>
                        {address}
                        <CopyButton text={address} message="Address copied" title="Copy address" />
                    </span>
                </div>
                {profile !== null && (
                    <span className={styles.vip}>
                        {profile.vip_tier} · {profile.rakeback_pct}% rakeback
                    </span>
                )}
            </div>

            {isLoading && <p className={styles.state}>Loading player…</p>}
            {!isLoading && error !== "" && <p className={`${styles.state} ${styles.stateError}`}>{error}</p>}

            {profile !== null && (
                <>
                    <div className={styles.tiles}>
                        {tiles.map(tile => (
                            <div key={tile.label} className={`pane-lite ${styles.tile}`}>
                                <span className="section-label">{tile.label}</span>
                                <span className={`${styles.tileValue} ${tile.tone === "pos" ? styles.pos : tile.tone === "neg" ? styles.neg : ""}`}>
                                    {tile.value}
                                </span>
                                <span className={styles.tileNote}>{tile.note}</span>
                            </div>
                        ))}
                    </div>

                    <h2 className={styles.sectionTitle}>Session history{sessionsTotal > 0 ? ` · ${sessionsTotal.toLocaleString()}` : ""}</h2>
                    <div className={`pane-lite ${styles.panel}`}>
                        <div className={`${styles.grid} ${styles.sessionGrid} ${styles.headRow}`}>
                            <span className="section-label">Table</span>
                            <span className={`section-label ${styles.right} ${styles.hideNarrow}`}>Join block</span>
                            <span className={`section-label ${styles.right} ${styles.hideNarrow}`}>Leave block</span>
                            <span className={`section-label ${styles.right}`}>Buy-in</span>
                            <span className={`section-label ${styles.right}`}>Cash-out</span>
                        </div>
                        {sessions.length === 0 && <p className={styles.state}>No sessions yet.</p>}
                        {sessions.map(session => {
                            const out = session.cash_out_amount;
                            return (
                                <div key={`${session.game_id}-${session.join_block}`} className={`row-hover ${styles.grid} ${styles.sessionGrid} ${styles.row}`}>
                                    <Link to={`/table/${session.game_id}`} className={styles.gameId} title={session.game_id}>
                                        {`${session.game_id.slice(0, 8)}…${session.game_id.slice(-6)}`}
                                    </Link>
                                    <span className={`${styles.num} ${styles.mono} ${styles.hideNarrow}`}>{session.join_block.toLocaleString()}</span>
                                    <span className={`${styles.num} ${styles.mono} ${styles.hideNarrow}`}>
                                        {session.leave_block === undefined ? "—" : session.leave_block.toLocaleString()}
                                    </span>
                                    <span className={styles.num}>{formatMicroUsd(session.buy_in_amount)}</span>
                                    <span
                                        className={`${styles.net} ${
                                            out === undefined ? "" : out >= session.buy_in_amount ? styles.pos : styles.neg
                                        }`}
                                    >
                                        {out === undefined ? "—" : formatMicroUsd(out)}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
};

export const PlayerProfileRoute: React.FC = () => {
    const { address } = useParams<{ address: string }>();
    if (address === undefined) return null;
    return <PlayerProfile address={address} />;
};

export default PlayerProfile;
