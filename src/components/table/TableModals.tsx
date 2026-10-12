import React from "react";
import type { GameOptionsDTO } from "@block52/poker-vm-sdk";
import { LeaveTableModal } from "../modal/LeaveTableModal";
import { TopUpModal } from "../modal/TopUpModal";
import { SitAndGoResultModal } from "../modal/SitAndGoResultModal";
import { JoinTableModal } from "../modal/JoinTableModal";
import { SitAndGoJoinModal } from "../modal/SitAndGoJoinModal";

interface TableModalsProps {
    /** One submission is in flight; every dialog locks its buttons. */
    isSubmitting: boolean;
    leave: {
        returnAmount: string;
        isTournament: boolean;
        isInActiveHand: boolean;
        onClose: () => void;
        onConfirm: () => Promise<void>;
    } | null;
    topUp: {
        stack: bigint;
        maxAddable: bigint;
        onClose: () => void;
        onConfirm: (amount: bigint) => Promise<void>;
    } | null;
    result: {
        place: number;
        payout: string | undefined;
        onClose: () => void;
        onClaim: () => Promise<void>;
        onLeave: () => Promise<void>;
    } | null;
    /** The seat being joined, with everything either join dialog needs. */
    join: {
        seatNumber: number;
        isTournament: boolean;
        gameOptions: GameOptionsDTO;
        seated: number;
        balance: string;
        onConfirm: (amount: string) => Promise<void>;
        onClose: () => void;
    } | null;
}

/** The dialogs a table can open: leave, top-up, Sit & Go result, and the join prompt. */
export const TableModals: React.FC<TableModalsProps> = ({ isSubmitting, leave, topUp, result, join }) => (
    <>
        {leave !== null && (
            <LeaveTableModal
                returnAmount={leave.returnAmount}
                isTournament={leave.isTournament}
                isInActiveHand={leave.isInActiveHand}
                isSubmitting={isSubmitting}
                onClose={leave.onClose}
                onConfirm={() => void leave.onConfirm()}
            />
        )}
        {topUp !== null && (
            <TopUpModal
                stack={topUp.stack}
                maxAddable={topUp.maxAddable}
                isSubmitting={isSubmitting}
                onClose={topUp.onClose}
                onConfirm={topUp.onConfirm}
            />
        )}
        {result !== null && (
            <SitAndGoResultModal place={result.place} payout={result.payout} onClose={result.onClose} onClaim={result.onClaim} onLeave={result.onLeave} />
        )}
        {join !== null &&
            (join.isTournament ? (
                <SitAndGoJoinModal
                    seatNumber={join.seatNumber}
                    buyIn={join.gameOptions.minBuyIn}
                    entryFee={join.gameOptions.entryFee}
                    startingStack={join.gameOptions.startingStack}
                    blindLevelMinutes={join.gameOptions.blindLevelDuration}
                    smallBlind={join.gameOptions.smallBlind}
                    bigBlind={join.gameOptions.bigBlind}
                    seated={join.seated}
                    maxPlayers={join.gameOptions.maxPlayers}
                    balance={join.balance}
                    isSubmitting={isSubmitting}
                    onConfirm={join.onConfirm}
                    onClose={join.onClose}
                />
            ) : (
                <JoinTableModal
                    seatNumber={join.seatNumber}
                    minBuyIn={join.gameOptions.minBuyIn}
                    maxBuyIn={join.gameOptions.maxBuyIn}
                    balance={join.balance}
                    isSubmitting={isSubmitting}
                    onClose={join.onClose}
                    onConfirm={join.onConfirm}
                />
            ))}
    </>
);

export default TableModals;
