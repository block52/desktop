import { useEffect, useState } from "react";
import { isSitAndGoFormat, type TexasHoldemStateDTO } from "@block52/poker-vm-sdk";
import { useNetwork } from "../context/NetworkContext";
import { isTablePlaying, isTournamentFinished } from "../utils/tournamentState";
import type { GameWithFormat } from "../utils/convertUtils";

const POLL_MS = 15000;
const BATCH = 10;

async function fetchPublicState(rest: string, gameId: string): Promise<TexasHoldemStateDTO> {
    const response = await fetch(`${rest}/block52/pokerchain/poker/v1/game_state_public/${encodeURIComponent(gameId)}`);
    if (!response.ok) throw new Error(`State request failed: ${response.status}`);
    const body: { game_state: string } = await response.json();
    return JSON.parse(body.game_state);
}

export type TableLiveStatus = "playing" | "finished" | "waiting";

/** Live status of the given tables (a hand in play, a finished Sit & Go, or waiting for players), re-checked while the list is on screen. */
export function useTablesStatus(games: GameWithFormat[]): ReadonlyMap<string, TableLiveStatus> {
    const { currentNetwork } = useNetwork();
    const [statuses, setStatuses] = useState<ReadonlyMap<string, TableLiveStatus>>(new Map());
    const idsKey = games.map(game => game.gameId).join(",");

    useEffect(() => {
        if (idsKey === "") return;
        const rest = currentNetwork.rest;
        const tracked = games;
        let cancelled = false;

        const check = async () => {
            const results: PromiseSettledResult<TexasHoldemStateDTO>[] = [];
            for (let start = 0; start < tracked.length; start += BATCH) {
                const batch = tracked.slice(start, start + BATCH);
                results.push(...(await Promise.allSettled(batch.map(game => fetchPublicState(rest, game.gameId)))));
                if (cancelled) return;
            }
            if (cancelled) return;
            const next = new Map<string, TableLiveStatus>();
            results.forEach((result, index) => {
                if (result.status !== "fulfilled") return;
                const game = tracked[index];
                const isTournament = isSitAndGoFormat(game.gameFormat);
                if (isTournamentFinished(result.value, isTournament)) next.set(game.gameId, "finished");
                else if (isTournament && game.currentPlayers < game.maxPlayers) next.set(game.gameId, "waiting");
                else if (isTablePlaying(result.value, isTournament)) next.set(game.gameId, "playing");
                else if (!isTournament && result.value.players.length < 2) next.set(game.gameId, "waiting");
            });
            setStatuses(next);
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

    return statuses;
}
