import { describe, expect, it } from "vitest";
import { NonPlayerActionType, PlayerStatus, GameFormat, type LegalActionDTO } from "@block52/poker-vm-sdk";
import { getPlayerActionDisplay, isBootstrap, type PlayerActionDisplayInput } from "./playerActionDisplay";

const legal = (...actions: string[]) => actions.map((action, index) => ({ action, index, min: undefined, max: undefined })) as unknown as LegalActionDTO[];

const BASE: PlayerActionDisplayInput = {
    playerStatus: PlayerStatus.SEATED,
    sitInMethod: null,
    legalActions: legal(NonPlayerActionType.SIT_IN),
    totalSeatedPlayers: 3,
    handNumber: 4,
    hasActivePlayers: true,
    sitInOptions: false,
    gameFormat: GameFormat.CASH
};

describe("getPlayerActionDisplay", () => {
    it("auto-sits-in a fresh joiner by default", () => {
        expect(getPlayerActionDisplay(BASE).kind).toBe("auto-sit-in");
    });

    it("shows the choice mid-orbit when sit-in options are on", () => {
        expect(getPlayerActionDisplay({ ...BASE, sitInOptions: true }).kind).toBe("sit-in-options");
    });

    it("shows a single Sit in on an empty table's first hand", () => {
        const display = getPlayerActionDisplay({ ...BASE, sitInOptions: true, hasActivePlayers: false, handNumber: 1 });
        expect(display.kind).toBe("sit-in-bootstrap");
        expect(isBootstrap(false, 1)).toBe(true);
    });

    it("never auto-sits-in someone who deliberately sat out", () => {
        const display = getPlayerActionDisplay({ ...BASE, playerStatus: PlayerStatus.SITTING_OUT });
        expect(display.kind).toBe("sit-in-options");
    });

    it("waits for players when alone", () => {
        expect(getPlayerActionDisplay({ ...BASE, totalSeatedPlayers: 1 }).kind).toBe("waiting-for-players");
    });

    it("reports a confirmed sit-in and a parked joiner as waiting", () => {
        expect(getPlayerActionDisplay({ ...BASE, playerStatus: PlayerStatus.SITTING_IN })).toEqual({
            kind: "pending",
            waitingMessage: "Waiting to sit in…"
        });
        expect(getPlayerActionDisplay({ ...BASE, playerStatus: PlayerStatus.WAITING_FOR_BIG_BLIND })).toEqual({
            kind: "pending",
            waitingMessage: "Waiting for next big blind…"
        });
    });

    it("offers sit-out on cash tables only", () => {
        const playing = { ...BASE, playerStatus: PlayerStatus.ACTIVE, legalActions: legal(NonPlayerActionType.SIT_OUT) };
        expect(getPlayerActionDisplay(playing).kind).toBe("sit-out-button");
        expect(getPlayerActionDisplay({ ...playing, gameFormat: GameFormat.SIT_AND_GO }).kind).toBe("none");
    });
});
