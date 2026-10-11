import { useMemo } from "react";
import type { TexasHoldemStateDTO } from "@block52/poker-vm-sdk";
import { computeEquities, equityInput } from "../utils/allInEquity";

const NO_EQUITIES: ReadonlyMap<number, number> = new Map();

/**
 * Win chances by seat while every live hand is all-in (or showing) or at showdown, computed on the client.
 * Recomputed only when the revealed hands or the board actually change, not on every table frame.
 */
export function useAllInEquity(gameState: TexasHoldemStateDTO | undefined): ReadonlyMap<number, number> {
    const input = equityInput(gameState);
    const key = input === null ? "" : JSON.stringify(input);

    return useMemo(() => {
        if (key === "") return NO_EQUITIES;
        return computeEquities(JSON.parse(key) as NonNullable<ReturnType<typeof equityInput>>);
    }, [key]);
}
