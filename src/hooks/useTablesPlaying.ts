import { useEffect, useState } from "react";
import { isSitAndGoFormat, type TexasHoldemStateDTO } from "@block52/poker-vm-sdk";
import { useNetwork } from "../context/NetworkContext";
import { isTablePlaying } from "../utils/tournamentState";
import type { GameWithFormat } from "../utils/convertUtils";

const POLL_MS = 15000;

async function fetchPublicState(rest: string, gameId: string): Promise<TexasHoldemStateDTO> {
    const response = await fetch(`${rest}/block52/pokerchain/poker/v1/game_state_public/${encodeURIComponent(gameId)}`);
    if (!response.ok) throw new Error(`State request failed: ${response.status}`);
    const body: { game_state: string } = await response.json();
    return JSON.parse(body.game_state);
}

/** Ids of the given tables that have a hand in play right now, re-checked while the list is on screen. */
export function useTablesPlaying(games: GameWithFormat[]): ReadonlySet<string> {
    const { currentNetwork } = useNetwork();
    const [playing, setPlaying] = useState<ReadonlySet<string>>(new Set());
    const idsKey = games.map(game => game.gameId).join(",");

    useEffect(() => {
        if (idsKey === "") return;
        const rest = currentNetwork.rest;
        const tracked = games;
        let cancelled = false;

        const check = async () => {
            const results = await Promise.allSettled(tracked.map(game => fetchPublicState(rest, game.gameId)));
            if (cancelled) return;
            const next = new Set<string>();
            results.forEach((result, index) => {
                if (result.status !== "fulfilled") return;
                const game = tracked[index];
                if (isTablePlaying(result.value, isSitAndGoFormat(game.gameFormat))) next.add(game.gameId);
            });
            setPlaying(next);
        };

        void check();
        const timer = setInterval(() => void check(), POLL_MS);
        return () => {
            cancelled = true;
            clearInterval(timer);
        };
        // idsKey stands in for the games array identity.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentNetwork, idsKey]);

    return playing;
}
