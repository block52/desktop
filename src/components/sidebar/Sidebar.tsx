import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import styles from "./Sidebar.module.css";
import { useNetwork } from "../../context/NetworkContext";
import { getCosmosClient } from "../../utils/cosmos/client";
import { NetworkSelector } from "../navbar/NetworkSelector";

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

interface NavItemProps {
    to?: string;
    active?: boolean;
    children: React.ReactNode;
}

const NavItem: React.FC<NavItemProps> = ({ to, active, children }) => {
    if (to) {
        return (
            <Link to={to} className={`${styles.navItem} ${active ? styles.navItemActive : ""}`}>
                {children}
            </Link>
        );
    }
    return (
        <button type="button" className={styles.navItemDisabled} disabled aria-disabled="true">
            {children}
        </button>
    );
};

const Sidebar: React.FC = () => {
    const location = useLocation();
    const { currentNetwork } = useNetwork();
    const [latestBlockHeight, setLatestBlockHeight] = useState<string | null>(null);

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
                }
            } catch {
                setLatestBlockHeight(null);
            }
        };

        fetchBlockHeight();
        const interval = setInterval(fetchBlockHeight, 10000);

        return () => clearInterval(interval);
    }, [currentNetwork]);

    const isLobby = location.pathname === "/";
    const isWallet = location.pathname === "/wallet";

    return (
        <aside className={styles.sidebar}>
            <Logo />

            <div className={styles.group}>
                <span className={styles.groupLabel}>Play</span>
                <NavItem to="/" active={isLobby}>Lobby</NavItem>
                <NavItem to="/wallet" active={isWallet}>Wallet</NavItem>
                <NavItem>Hand history</NavItem>
                <NavItem>Players</NavItem>
            </div>

            <div className={styles.group}>
                <span className={styles.groupLabel}>Network</span>
                <div className={styles.networkSelectorWrap}>
                    <NetworkSelector />
                </div>
                <NavItem>Block explorer</NavItem>
                <NavItem>Hand distribution</NavItem>
                <NavItem>Tech notes</NavItem>
            </div>

            <div className={styles.footer}>
                <NavItem>Admin</NavItem>
                <div className={styles.statusChip}>
                    <span className={styles.statusDot} />
                    <span className={styles.statusText}>
                        {currentNetwork.name}
                        {latestBlockHeight !== null && (
                            <> · Block #{Number(latestBlockHeight).toLocaleString()}</>
                        )}
                    </span>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
