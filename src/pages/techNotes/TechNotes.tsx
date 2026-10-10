import { useReleaseNotes } from "../../hooks/useReleaseNotes";
import ReleaseNotesList from "../../components/techNotes/ReleaseNotesList";
import NotesGrid, { type TechNote } from "../../components/techNotes/NotesGrid";
import styles from "./TechNotes.module.css";

/** How Block52 works — the real tech notes. */
const TECH_NOTES: TechNote[] = [
    {
        tag: "SHUFFLING",
        title: "Provably fair shuffling",
        body: "Every deck is committed on-chain before cards are dealt. The deck commitment lives in the game state, and each state transition carries a validator signature — so any shuffle can be audited after the hand. No trust in the house required."
    },
    {
        tag: "PVM",
        title: "Poker Virtual Machine",
        body: "Game logic runs in the PVM — a deterministic poker state machine executed by every validator. Actions are replayed from the same log, so all nodes converge on identical game state: pots, side pots, showdowns and payouts are computed, not trusted."
    },
    {
        tag: "SETTLEMENT",
        title: "Cosmos settlement",
        body: "Block52 is a Cosmos SDK chain. Balances are held in usdc (micro-USDC, 6 decimals) and game actions settle as gasless transactions with a protocol-level gas price — players never pay gas to bet, call, or fold."
    },
    {
        tag: "NODES",
        title: "Run your own node",
        body: "The chain is validated by independent operators. Spin up a node, bond the minimum validator stake, and add your endpoint under Networks to deal hands through your own infrastructure."
    }
];

const TechNotes: React.FC = () => {
    const { notes, isLoading, error, reload } = useReleaseNotes();

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <h1 className={styles.title}>Tech notes</h1>
                <p className={styles.subtitle}>How the Poker VM works, written by the people building it.</p>
            </div>

            <NotesGrid notes={TECH_NOTES} />

            {isLoading && (
                <div className={`pane-lite ${styles.stateBox}`}>
                    <div className={styles.spinner} />
                    <p className={styles.stateText}>Loading release notes…</p>
                </div>
            )}

            {error !== "" && (
                <div className={`pane-lite ${styles.stateBox}`}>
                    <p className={styles.stateText}>{error}</p>
                    <button className={`btn-ghost ${styles.retryButton}`} onClick={reload}>
                        Retry
                    </button>
                </div>
            )}

            {error === "" && !isLoading && notes.length === 0 && (
                <div className={`pane-lite ${styles.stateBox}`}>
                    <p className={styles.stateText}>No release notes found.</p>
                </div>
            )}

            {notes.length > 0 && (
                <>
                    <h2 className={styles.sectionTitle}>Release notes</h2>
                    <ReleaseNotesList notes={notes} />
                </>
            )}
        </div>
    );
};

export default TechNotes;
