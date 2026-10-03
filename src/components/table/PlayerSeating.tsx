import React from "react";
import type { PlayerDTO } from "@block52/poker-vm-sdk";
import { getSeatPercent, resolveTableSize, seatToUiPosition } from "../../config/seatGeometry";
import { Seat } from "./Seat";
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
}

export const PlayerSeating: React.FC<PlayerSeatingProps> = ({
    players,
    maxPlayers,
    localAddress,
    nextToAct,
    smallBlindPosition,
    bigBlindPosition,
    dealer,
    formatStack,
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
            seats.push(<Seat key={serverSeat} left={left} top={top} occupied={false} />);
            continue;
        }

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
                name={player.address}
                stack={formatStack(player.stack)}
                currentBet={player.sumOfBets !== "0" ? formatStack(player.sumOfBets) : undefined}
                showCards={true}
            />
        );
    }

    return <div className={styles.plane}>{seats}</div>;
};

export default PlayerSeating;
