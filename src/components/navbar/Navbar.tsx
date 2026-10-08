import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import styles from "./Navbar.module.css";
import { useNetwork } from "../../context/NetworkContext";
import { getCosmosClient } from "../../utils/cosmos/client";
import { NetworkSelector } from "./NetworkSelector";

const Logo: React.FC = () => {
  const [imgError, setImgError] = useState(false);
  return (
    <Link to="/" className={styles.logo}>
      {!imgError ? (
        <img
          src="/block52.png"
          alt="Block52"
          className={styles.logoImage}
          onError={() => setImgError(true)}
        />
      ) : (
        <span className={styles.logoText}>
          block<span className={styles.logoAccent}>52</span>
          <span className={styles.logoDiamond}>◆</span>
        </span>
      )}
    </Link>
  );
};

const TablesIcon: React.FC = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);

const ExternalLinkIcon: React.FC = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

const RefreshIcon: React.FC = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="23 4 23 10 17 10" />
    <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
  </svg>
);

const Navbar: React.FC = () => {
  const location = useLocation();
  const [spinning, setSpinning] = useState(false);
  const { currentNetwork } = useNetwork();
  const [latestBlockHeight, setLatestBlockHeight] = useState<string | null>(
    null,
  );
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const fetchBlockHeight = async () => {
      try {
        const cosmosClient = getCosmosClient({
          rpc: currentNetwork.rpc,
          rest: currentNetwork.rest,
        });

        if (!cosmosClient) return;

        const blocks = await cosmosClient.getLatestBlocks(1);
        if (blocks.length > 0) {
          setLatestBlockHeight(blocks[0].block.header.height);
          setHasError(false);
        }
      } catch {
        setHasError(true);
      }
    };

    fetchBlockHeight();
    const interval = setInterval(fetchBlockHeight, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, [currentNetwork]);

  if (location.pathname.startsWith("/table/")) return null;

  const handleRefresh = () => {
    setSpinning(true);
    window.location.reload();
  };

  const isTablesActive =
    location.pathname === "/" || location.pathname.startsWith("/tables");

  return (
    <header className={styles.navbar}>
      <div className={styles.inner}>
        <Logo />

        <nav className={styles.nav}>
          <Link
            to="/"
            className={`${styles.navLink} ${isTablesActive ? styles.navLinkActive : ""}`}
          >
            <TablesIcon />
            Tables
          </Link>

          <a href={""} className={styles.navLink} onClick={() => {}}>
            <ExternalLinkIcon />
            Block Explorer
          </a>
        </nav>

        <div className={styles.right}>
          {latestBlockHeight !== null && (
            <div className={styles.blockBadge}>
              <span className={styles.blockDot} />
              <span className={styles.blockNumber}>
                #{latestBlockHeight.toLocaleString()}
              </span>
            </div>
          )}

          <NetworkSelector />

          <button
            className={`${styles.iconBtn} ${spinning ? styles.spinning : ""}`}
            onClick={handleRefresh}
            title="Refresh"
            onAnimationEnd={() => setSpinning(false)}
          >
            <RefreshIcon />
          </button>

          <div className={styles.nftBadge}>NFT</div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
