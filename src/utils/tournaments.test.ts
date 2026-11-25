import { describe, expect, it } from "vitest";
import type { TournamentStateDTO } from "@block52/poker-vm-sdk";
import { mySeat, timeLeft, urgencyOf, blindLines, createdTournamentIds, entrantCount, isRegistered, sortTournaments, totalCost, tournamentIdOf, usdc } from "./tournaments";

const ID = `0x${"ab".repeat(32)}`;

function tournament(status: TournamentStateDTO["status"], entrants: TournamentStateDTO["entrants"] = []): TournamentStateDTO {
    return { tournamentId: ID, status, entrants, options: { buyIn: "2000000", entryFee: "200000" } } as unknown as TournamentStateDTO;
}

describe("tournamentIdOf", () => {
    it("takes a tournament id, or one of its table ids, in any case", () => {
        expect(tournamentIdOf(ID)).toBe(ID);
        expect(tournamentIdOf(`  ${ID.toUpperCase().replace("0X", "0x")}-t12 `)).toBe(ID);
    });
    it("refuses anything else", () => {
        expect(tournamentIdOf("0x1234")).toBeNull();
        expect(tournamentIdOf(`${ID}-x1`)).toBeNull();
        expect(tournamentIdOf("my table")).toBeNull();
    });
});

describe("createdTournamentIds", () => {
    const event = (id: string) => ({ tx_result: { events: [{ type: "transfer", attributes: [] }, { type: "tournament_created", attributes: [{ key: "tournament_id", value: id }] }] } });
    it("reads tournament_created events in order without repeats and skips junk", () => {
        const other = `0x${"cd".repeat(32)}`;
        expect(createdTournamentIds([event(ID), event(other), event(ID), event("nope"), {}])).toEqual([ID, other]);
    });
});

describe("amounts", () => {
    it("formats micro-USDC and adds the fee to the buy-in", () => {
        expect(usdc("2000000")).toBe("2");
        expect(usdc("")).toBe("0");
        expect(usdc(undefined)).toBe("0");
        expect(totalCost(tournament("registering").options)).toBe("2.2");
    });
});

describe("entrants", () => {
    const entrants = [
        { address: "b521AAA", status: "registered", stack: "0" },
        { address: "b521bbb", status: "unregistered", stack: "0" }
    ] as TournamentStateDTO["entrants"];
    it("counts those still in the field", () => {
        expect(entrantCount(tournament("registering", entrants))).toBe(1);
    });
    it("knows whether an address is registered, ignoring case and withdrawn entries", () => {
        const t = tournament("registering", entrants);
        expect(isRegistered(t, "b521aaa")).toBe(true);
        expect(isRegistered(t, "b521BBB")).toBe(false);
        expect(isRegistered(t, null)).toBe(false);
    });
});

describe("sortTournaments", () => {
    it("puts running above registering above finished, keeping the given order within a status", () => {
        const a = { ...tournament("finished"), tournamentId: "a" };
        const b = { ...tournament("registering"), tournamentId: "b" };
        const c = { ...tournament("running"), tournamentId: "c" };
        const d = { ...tournament("registering"), tournamentId: "d" };
        expect(sortTournaments([a, b, c, d]).map(t => t.tournamentId)).toEqual(["c", "b", "d", "a"]);
    });
});

describe("blindLines", () => {
    it("lists table levels, marking breaks and antes", () => {
        const options = {
            blindStructure: {
                progression: "table",
                levels: [
                    { level: 0, smallBlind: "10", bigBlind: "20", ante: "0", durationMinutes: 5, isBreak: false },
                    { level: 1, smallBlind: "20", bigBlind: "40", ante: "5", durationMinutes: 5, isBreak: false },
                    { level: 2, smallBlind: "", bigBlind: "", ante: "0", durationMinutes: 10, isBreak: true }
                ]
            }
        } as unknown as TournamentStateDTO["options"];
        expect(blindLines(options).map(line => `${line.label}: ${line.text}`)).toEqual(["Level 1: 10 / 20 · 5 min", "Level 2: 20 / 40 ante 5 · 5 min", "Break: 10 min"]);
    });
    it("describes a preset and a formula in one line", () => {
        expect(blindLines({ blindStructure: { preset: "hyper_turbo" } } as unknown as TournamentStateDTO["options"])[0].text).toBe("hyper turbo");
        expect(blindLines({ blindStructure: { progression: "double", startSmallBlind: "25", startBigBlind: "50", durationMinutes: 10 } } as unknown as TournamentStateDTO["options"])[0].text).toBe("25 / 50 · 10 min a level");
    });
});

describe("mySeat", () => {
    const running = {
        ...tournament("running", [
            { address: "b521AAA", status: "playing", tableId: "T-t2", seat: 5, stack: "4200" },
            { address: "b521bbb", status: "busted", stack: "0" }
        ] as TournamentStateDTO["entrants"]),
        tables: [{ tableId: "T-t2", ordinal: 2, players: ["b521AAA"], broken: false, handNumber: 1, atBoundary: false }]
    } as unknown as TournamentStateDTO;

    it("finds the table, its number, the seat and the stack, ignoring address case", () => {
        expect(mySeat(running, "b521aaa")).toEqual({ status: "playing", tableId: "T-t2", seat: 5, ordinal: 2, stack: "4200" });
    });
    it("has no table once busted, and nothing for a stranger or no wallet", () => {
        expect(mySeat(running, "b521bbb")).toMatchObject({ status: "busted", tableId: null, seat: null, ordinal: null });
        expect(mySeat(running, "b521zzz")).toBeNull();
        expect(mySeat(running, null)).toBeNull();
    });
});

describe("timeLeft", () => {
    it("splits the wait and rounds a part-second up", () => {
        expect(timeLeft(1_000 * (2 * 86_400 + 3 * 3600 + 4 * 60 + 5), 0)).toMatchObject({ days: 2, hours: 3, minutes: 4, seconds: 5, done: false });
        expect(timeLeft(1_500, 0).totalSeconds).toBe(2);
    });
    it("is done at and after the start", () => {
        expect(timeLeft(5_000, 5_000).done).toBe(true);
        expect(timeLeft(5_000, 9_000)).toMatchObject({ totalSeconds: 0, done: true });
    });
});

describe("urgencyOf", () => {
    it("steps up as the start nears", () => {
        expect(urgencyOf(7200)).toBe("calm");
        expect(urgencyOf(3600)).toBe("soon");
        expect(urgencyOf(61)).toBe("soon");
        expect(urgencyOf(60)).toBe("minute");
        expect(urgencyOf(11)).toBe("minute");
        expect(urgencyOf(10)).toBe("final");
        expect(urgencyOf(0)).toBe("final");
    });
});
