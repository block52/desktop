import React, { useState } from "react";
import DepositModal from "../../components/modal/DepositModal";
import { useCosmosWallet } from "../../hooks/useCosmosWallet";
import TableList from "../../components/tableList/TableList";
import FeaturedTable from "../../components/featuredTable/FeaturedTable";
import LiveStats from "../../components/liveStats/LiveStats";
import { useFindGames } from "../../hooks/useFindGames";
import { useAvgBlockTime } from "../../hooks/useAvgBlockTime";
import { selectFeaturedGame } from "../../utils/selectFeaturedGame";
import { COSMOS_CONSTANTS } from "@block52/poker-vm-sdk";
import styles from "./Dashboard.module.css";

const Dashboard: React.FC = () => {
  const { address: cosmosAddress, balance, refreshBalance } = useCosmosWallet();

  const [showDepositModal, setShowDepositModal] = useState(false);

  const usdcBalanceAmount =
    balance.find((b) => b.denom === COSMOS_CONSTANTS.TOKEN_DENOM)?.amount ?? "0";

  const avatarInitials = cosmosAddress
    ? cosmosAddress.slice(2, 4).toUpperCase()
    : null;

  const { games } = useFindGames();
  const { avgBlockTimeSeconds } = useAvgBlockTime();
  const featuredGame = selectFeaturedGame(games);
  const seatedPlayers = games.reduce((sum, g) => sum + g.currentPlayers, 0);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Lobby</h1>
          <p className={styles.subtitle}>Every shuffle verified on-chain. Pick a seat.</p>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.balancePill}>
            ${(Number(usdcBalanceAmount) / Math.pow(10, COSMOS_CONSTANTS.USDC_DECIMALS)).toFixed(2)}
          </div>
          <button className={styles.depositButton} onClick={() => setShowDepositModal(true)} disabled={!cosmosAddress}>
            Deposit
          </button>
          {avatarInitials && <div className={styles.avatar}>{avatarInitials}</div>}
        </div>
      </div>

      <div className={styles.overviewRow}>
        <FeaturedTable game={featuredGame} />
        <LiveStats
          openTables={games.length}
          seatedPlayers={seatedPlayers}
          avgBlockTimeSeconds={avgBlockTimeSeconds}
        />
      </div>

      <TableList />

      {showDepositModal && cosmosAddress && (
        <DepositModal
          cosmosAddress={cosmosAddress}
          onClose={() => setShowDepositModal(false)}
          onDepositConfirmed={refreshBalance}
        />
      )}
    </div>
  );
};

export default Dashboard;
