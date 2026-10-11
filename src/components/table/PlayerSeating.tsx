import React from "react";
import { PlayerStatus, type PlayerDTO } from "@block52/poker-vm-sdk";
import { getSeatPercent, resolveTableSize, seatToUiPosition } from "../../config/seatGeometry";
import { Seat } from "./Seat";
import type { SeatStatusLabel } from "./SeatBanner";
import { shortAddress } from "./shortAddress";
import styles from "./PlayerSeating.module.css";

export interface PlayerSeatingProps {
    players: PlayerDTO[];
    maxPlayers: number;
    /** The local player's own address (lowercased), to resolve their seat for the hero-rotation. */
    localAddress: string | null;
    nextToAct: number;
    smallBlindPosition?: number;
    bigBlindPosition?: number;
    dealer?: number;
    formatStack: (stack: string) => string;
    /** Seconds a seat has to act; drives the turn countdown on the seat to act. */
    turnTimeoutSec?: number;
    /** Pot winners keyed by server seat, with the amount already formatted for display. */
    winnersBySeat?: Map<number, { amount: string; description?: string }>;
    /** Codes of the cards in the winning hands. */
    winningCards?: string[];
    /** Converts a raw amount to the whole-dollar/chip value used to draw chip piles. */
    chipValue: (amount: string) => number;
    /** Max buy-in in the same micro units as player stacks; drives the hero's stack bar. Omit/0 to hide it. */
    maxBuyIn?: string;
    /** When set, vacant seats are clickable and report their server seat number. */
    onVacantSeatClick?: (serverSeat: number) => void;
}


const SEAT_STATUS_LABELS: Partial<Record<PlayerStatus, SeatStatusLabel>> = {
    [PlayerStatus.FOLDED]: "FOLD",
    [PlayerStatus.ALL_IN]: "ALL IN",
    [PlayerStatus.SITTING_OUT]: "SITTING OUT"
};

export const PlayerSeating: React.FC<PlayerSeatingProps> = ({
    players,
    maxPlayers,
    localAddress,
    nextToAct,
    smallBlindPosition,
    bigBlindPosition,
    dealer,
    formatStack,
    chipValue,
    turnTimeoutSec,
    winnersBySeat,
    winningCards,
    maxBuyIn,
    onVacantSeatClick,
}) => {
    const tableSize = resolveTableSize(maxPlayers);

    // The hero's own seat anchors the rotation. If the local player isn't
    // seated (spectating, or hasn't joined yet), fall back to no rotation
    // (seat 1 renders at position 0) rather than guessing.
    const localPlayer = localAddress ? players.find(p => p.address.toLowerCase() === localAddress) : undefined;
    const heroServerSeat = localPlayer?.seat ?? 1;

    const playersBySeat = new Map<number, PlayerDTO>();
    for (const player of players) {
        playersBySeat.set(player.seat, player);
    }

    const seats = [];
    for (let serverSeat = 1; serverSeat <= tableSize; serverSeat++) {
        const uiPosition = seatToUiPosition(serverSeat, heroServerSeat, tableSize);
        const { left, top } = getSeatPercent(tableSize, uiPosition);
        const player = playersBySeat.get(serverSeat);

        if (!player) {
            seats.push(
                <Seat
                    key={serverSeat}
                    left={left}
                    top={top}
                    occupied={false}
                    onSelect={onVacantSeatClick !== undefined ? () => onVacantSeatClick(serverSeat) : undefined}
                />
            );
            continue;
        }

        const isHero = localPlayer !== undefined && player.seat === localPlayer.seat;
        const maxBuyInMicro = maxBuyIn !== undefined ? Number(maxBuyIn) : 0;

        seats.push(
            <Seat
                key={serverSeat}
                left={left}
                top={top}
                occupied={true}
                isActive={nextToAct === serverSeat}
                isSmallBlind={player.isSmallBlind || smallBlindPosition === serverSeat}
                isBigBlind={player.isBigBlind || bigBlindPosition === serverSeat}
                isDealer={player.isDealer || dealer === serverSeat}
                isFolded={player.status === PlayerStatus.FOLDED}
                isHero={isHero}
                stackFraction={isHero && maxBuyInMicro > 0 ? Number(player.stack) / maxBuyInMicro : undefined}
                name={shortAddress(player.address)}
                stack={formatStack(player.stack)}
                currentBet={player.sumOfBets !== "0" ? formatStack(player.sumOfBets) : undefined}
                betValue={player.sumOfBets !== "0" ? chipValue(player.sumOfBets) : undefined}
                holeCards={player.holeCards ?? undefined}
                avatar={player.avatar}
                lastAction={
                    player.lastAction !== undefined
                        ? {
                              action: player.lastAction.action,
                              amount:
                                  player.lastAction.amount !== "" && player.lastAction.amount !== "0"
                                      ? formatStack(player.lastAction.amount)
                                      : undefined,
                              index: player.lastAction.index
                          }
                        : undefined
                }
                turnTimeoutSec={turnTimeoutSec}
                statusLabel={SEAT_STATUS_LABELS[player.status]}
                winner={winnersBySeat?.get(serverSeat)}
                winningCards={winningCards}
            />
        );
    }

    return <div className={styles.plane}>{seats}</div>;
};

export default PlayerSeating;
