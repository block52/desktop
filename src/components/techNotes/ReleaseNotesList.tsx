import { useState } from "react";
import type { ReleaseNote } from "../../hooks/useReleaseNotes";
import styles from "./ReleaseNotesList.module.css";

interface ReleaseNotesListProps {
    notes: ReleaseNote[];
}

function formatDate(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

interface SectionProps {
    title: string;
    items: string[];
    colorClass: string;
}

const Section: React.FC<SectionProps> = ({ title, items, colorClass }) => {
    if (items.length === 0) return null;
    return (
        <div className={styles.section}>
            <h3 className={`${styles.sectionTitle} ${colorClass}`}>{title}</h3>
            <ul className={styles.sectionList}>
                {items.map((item, i) => (
                    <li key={i} className={styles.sectionItem}>
                        <span className={`${styles.dot} ${colorClass}`} />
                        {item}
                    </li>
                ))}
            </ul>
        </div>
    );
};

const NoteCard: React.FC<{ note: ReleaseNote }> = ({ note }) => {
    const [expanded, setExpanded] = useState(false);
    const isStructured =
        note.highlights.length > 0 || note.features.length > 0 || note.bugFixes.length > 0 ||
        note.improvements.length > 0 || note.tests.length > 0;

    return (
        <div className={`pane-lite ${styles.card}`}>
            <div className={styles.cardHead}>
                <div className={styles.cardTitleRow}>
                    {note.tags.map(tag => (
                        <span key={tag} className={styles.tag}>
                            {tag}
                        </span>
                    ))}
                    {note.version !== null && <span className={styles.version}>{note.version}</span>}
                    <h2 className={styles.title}>{note.title}</h2>
                </div>
                <span className={styles.date}>{formatDate(note.date)}</span>
            </div>

            {isStructured ? (
                <>
                    <Section title="Highlights" items={note.highlights} colorClass={styles.colorYellow} />
                    {expanded && (
                        <>
                            <Section title="Features" items={note.features} colorClass={styles.colorGreen} />
                            <Section title="Bug Fixes" items={note.bugFixes} colorClass={styles.colorRed} />
                            <Section title="Improvements" items={note.improvements} colorClass={styles.colorBlue} />
                            <Section title="Tests" items={note.tests} colorClass={styles.colorTeal} />
                        </>
                    )}
                    <button className={styles.toggle} onClick={() => setExpanded(v => !v)}>
                        {expanded ? "Show less" : "Show features, fixes & improvements"}
                    </button>
                </>
            ) : (
                note.body !== "" && <pre className={styles.body}>{note.body.trim()}</pre>
            )}
        </div>
    );
};

const ReleaseNotesList: React.FC<ReleaseNotesListProps> = ({ notes }) => (
    <div className={styles.list}>
        {notes.map(note => (
            <NoteCard key={note.id} note={note} />
        ))}
    </div>
);

export default ReleaseNotesList;
