import React, { useEffect, useRef, useState } from "react";
import type { PlayerNote, PlayersBridge, Tag } from "../../players/types";
import { NICKNAME_MAX, NOTES_MAX, TAG_MAX } from "../../players/types";
import { usePlayerNote } from "../../hooks/usePlayerNotes";
import styles from "./PlayerNotesPanel.module.css";

/**
 * Your private notes on a player: nickname, free-text notes and tags. Lives on
 * the Player profile. Everything is local (SQLite in the main process) and
 * saved through the players.* bridge; nothing is sent anywhere (#63).
 */
const PlayerNotesPanel: React.FC<{ address: string }> = ({ address }) => {
    const { note, refresh } = usePlayerNote(address);
    const players = window.electronAPI?.players;

    if (players === undefined) return null; // plain browser: no local store

    return <Editor address={address} note={note} refresh={refresh} players={players} />;
};

interface EditorProps {
    address: string;
    note: PlayerNote | null;
    refresh: () => void;
    players: PlayersBridge;
}

const Editor: React.FC<EditorProps> = ({ address, note, refresh, players }) => {
    const [nickname, setNickname] = useState("");
    const [notes, setNotes] = useState("");
    const [newTag, setNewTag] = useState("");
    const [allTags, setAllTags] = useState<Tag[]>([]);
    const loadedFor = useRef<string | null>(null);

    // Seed the inputs from the stored note once per player (not on every refresh,
    // so typing is not clobbered).
    useEffect(() => {
        if (note !== null && loadedFor.current !== address) {
            setNickname(note.nickname ?? "");
            setNotes(note.notes ?? "");
            loadedFor.current = address;
        }
    }, [address, note]);

    useEffect(() => {
        players.listTags().then(setAllTags).catch(() => setAllTags([]));
    }, [players]);

    const tags = note?.tags ?? [];
    const taggedIds = new Set(tags.map(t => t.id));
    const suggestions = allTags.filter(t => !taggedIds.has(t.id));

    const saveNickname = async () => {
        await players.setNickname(address, nickname.trim() === "" ? null : nickname.trim());
        refresh();
    };
    const saveNotes = async () => {
        await players.setNotes(address, notes.trim() === "" ? null : notes.trim());
        refresh();
    };
    const addTag = async (name: string) => {
        const clean = name.trim();
        if (clean === "") return;
        await players.addTag(address, clean);
        setNewTag("");
        players.listTags().then(setAllTags).catch(() => undefined);
        refresh();
    };
    const removeTag = async (tagId: number) => {
        await players.removeTag(address, tagId);
        refresh();
    };

    return (
        <div className={`pane-lite ${styles.panel}`}>
            <span className="section-label">Your notes</span>

            <label className={styles.field}>
                <span className={styles.label}>Nickname</span>
                <input
                    className={styles.input}
                    value={nickname}
                    maxLength={NICKNAME_MAX}
                    placeholder="e.g. The Villain"
                    onChange={e => setNickname(e.target.value)}
                    onBlur={saveNickname}
                />
            </label>

            <label className={styles.field}>
                <span className={styles.label}>Notes</span>
                <textarea
                    className={styles.textarea}
                    value={notes}
                    maxLength={NOTES_MAX}
                    rows={4}
                    placeholder="How do they play?"
                    onChange={e => setNotes(e.target.value)}
                    onBlur={saveNotes}
                />
            </label>

            <div className={styles.field}>
                <span className={styles.label}>Tags</span>
                <div className={styles.tagRow}>
                    {tags.map(tag => (
                        <span key={tag.id} className={styles.tag}>
                            {tag.name}
                            <button type="button" className={styles.tagX} onClick={() => removeTag(tag.id)} aria-label={`Remove ${tag.name}`}>
                                ×
                            </button>
                        </span>
                    ))}
                    <input
                        className={styles.tagInput}
                        value={newTag}
                        maxLength={TAG_MAX}
                        placeholder="Add tag"
                        onChange={e => setNewTag(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === "Enter") {
                                e.preventDefault();
                                void addTag(newTag);
                            }
                        }}
                    />
                </div>
                {suggestions.length > 0 && (
                    <div className={styles.suggestions}>
                        {suggestions.map(tag => (
                            <button key={tag.id} type="button" className={styles.suggestion} onClick={() => addTag(tag.name)}>
                                + {tag.name}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default PlayerNotesPanel;
