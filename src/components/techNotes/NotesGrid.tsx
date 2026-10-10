import styles from "./NotesGrid.module.css";

export interface TechNote {
    tag: string;
    title: string;
    body: string;
}

interface NotesGridProps {
    notes: TechNote[];
}

const NotesGrid: React.FC<NotesGridProps> = ({ notes }) => (
    <div className={styles.grid}>
        {notes.map(note => (
            <div key={note.title} className={`pane-lite ${styles.card}`}>
                <div className={styles.cardHead}>
                    <span className={styles.tag}>{note.tag}</span>
                </div>
                <span className={styles.title}>{note.title}</span>
                <p className={styles.body}>{note.body}</p>
            </div>
        ))}
    </div>
);

export default NotesGrid;
