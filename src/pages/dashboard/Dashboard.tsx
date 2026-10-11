import React, { useEffect, useRef, useState } from "react";
import DepositModal from "../../components/modal/DepositModal";
import { useCosmosWallet } from "../../hooks/useCosmosWallet";
import TableList from "../../components/tableList/TableList";
import FeaturedCarousel from "../../components/featuredTable/FeaturedCarousel";
import LastSession from "../../components/lastSession/LastSession";
import LiveStats from "../../components/liveStats/LiveStats";
import { useFindGames } from "../../hooks/useFindGames";
import { useAvgBlockTime } from "../../hooks/useAvgBlockTime";
import { selectFeaturedGame } from "../../utils/selectFeaturedGame";
import { COSMOS_CONSTANTS } from "@block52/poker-vm-sdk";
import usdcUrl from "../../assets/lobby/usdc.svg";
import styles from "./Dashboard.module.css";

const Dashboard: React.FC = () => {
  const { address: cosmosAddress, balance, refreshBalance } = useCosmosWallet();

  const [showDepositModal, setShowDepositModal] = useState(false);
  const [search, setSearch] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const usdcBalanceAmount =
    balance.find((b) => b.denom === COSMOS_CONSTANTS.TOKEN_DENOM)?.amount ?? "0";

  const avatarInitials = cosmosAddress
    ? cosmosAddress.slice(2, 4).toUpperCase()
    : null;

  const { games } = useFindGames();
  const { avgBlockTimeSeconds } = useAvgBlockTime();
  const featuredGame = selectFeaturedGame(games);
  const seatedPlayers = games.reduce((sum, g) => sum + g.currentPlayers, 0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "/") return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      e.preventDefault();
      searchInputRef.current?.focus();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>Lobby</h1>
          <p className={styles.subtitle}>Every shuffle verified on-chain. Pick a seat.</p>
        </div>

        <div className={`search-field ${styles.searchField}`} onClick={() => searchInputRef.current?.focus()}>
          <svg className={styles.searchIcon} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            ref={searchInputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search table name or ID"
            className={styles.searchInput}
          />
          <kbd className="kbd">/</kbd>
        </div>

        <div className={styles.headerRight}>
          <div className={styles.balancePill}>
            <img src={usdcUrl} alt="USDC" className={styles.usdcIcon} />
            <span className={styles.balanceAmount}>
              ${(Number(usdcBalanceAmount) / Math.pow(10, COSMOS_CONSTANTS.USDC_DECIMALS)).toFixed(2)}
            </span>
            <button className={styles.depositChip} onClick={() => setShowDepositModal(true)} disabled={!cosmosAddress}>
              Deposit
            </button>
          </div>
          {avatarInitials && <div className={styles.avatar}>{avatarInitials}</div>}
        </div>
      </div>

      <div className={styles.heroRow}>
        <FeaturedCarousel game={featuredGame} />
        <div className={styles.statColumn}>
          <LastSession />
          <LiveStats
            openTables={games.length}
            seatedPlayers={seatedPlayers}
            avgBlockTimeSeconds={avgBlockTimeSeconds}
          />
        </div>
      </div>

      <TableList search={search} />

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
