import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import styles from "./Sidebar.module.css";
import { useNetwork } from "../../context/NetworkContext";
import type { NetworkEndpoints } from "../../context/NetworkContext";
import { getCosmosClient } from "../../utils/cosmos/client";
import logoUrl from "../../assets/brand/logo.png";

/* Icon paths copied from the redesign mockup (24 viewBox, stroke currentColor, stroke-width 1.8). */
const ICONS: Record<string, string[]> = {
    lobby: [
        "M5 9c-1.5 1.5-3 3.2-3 5.5A5.5 5.5 0 0 0 7.5 20c1.8 0 3-.5 4.5-2 1.5 1.5 2.7 2 4.5 2a5.5 5.5 0 0 0 5.5-5.5c0-2.3-1.5-4-3-5.5l-7-7-7 7Z",
        "M12 18v4"
    ],
    wallet: [
        "M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1",
        "M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"
    ],
    history: ["M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8", "M3 3v5h5", "M12 7v5l4 2"],
    players: [
        "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",
        "M5 7a4 4 0 1 0 8 0a4 4 0 1 0-8 0",
        "M22 21v-2a4 4 0 0 0-3-3.87",
        "M16 3.13a4 4 0 0 1 0 7.75"
    ],
    explorer: [
        "M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z",
        "m3.3 7 8.7 5 8.7-5",
        "M12 22V12"
    ],
    distribution: ["M3 3v18h18", "M18 17V9", "M13 17V5", "M8 17v-3"],
    nodes: [
        "M4 2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z",
        "M4 14h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2z",
        "M6 6h.01",
        "M6 18h.01"
    ],
    notes: [
        "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z",
        "M14 2v4a2 2 0 0 0 2 2h4",
        "M16 13H8",
        "M16 17H8"
    ],
    admin: [
        "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1 1 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"
    ]
};

const NavIcon: React.FC<{ paths: string[] }> = ({ paths }) => (
    <svg
        className="nav-icon"
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        {paths.map(d => (
            <path key={d} d={d} />
        ))}
    </svg>
);

const ChevronUpIcon: React.FC = () => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="18 15 12 9 6 15" />
    </svg>
);

const CheckIcon: React.FC = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
    </svg>
);

interface NavItemProps {
    to?: string;
    active?: boolean;
    icon: string;
    label: string;
}

const NavItem: React.FC<NavItemProps> = ({ to, active, icon, label }) => {
    if (to) {
        return (
            <Link to={to} title={label} className={active ? "nav-item active" : "nav-item"}>
                <NavIcon paths={ICONS[icon]} />
                <span className={styles.navLabel}>{label}</span>
            </Link>
        );
    }
    return (
        <button type="button" title={label} className={styles.navItemDisabled} disabled aria-disabled="true">
            <NavIcon paths={ICONS[icon]} />
            <span className={styles.navLabel}>{label}</span>
        </button>
    );
};

/** The status chip doubles as the network switcher: clicking it opens an
 *  upward popover listing presets + discovered networks. */
const NetworkSwitcher: React.FC = () => {
    const { currentNetwork, setNetwork, availableNetworks, discoveredNetworks } = useNetwork();
    const [isOpen, setIsOpen] = useState(false);
    const [latestBlockHeight, setLatestBlockHeight] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchBlockHeight = async () => {
            try {
                const cosmosClient = getCosmosClient({
                    rpc: currentNetwork.rpc,
                    rest: currentNetwork.rest
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

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen]);

    const selectNetwork = (network: NetworkEndpoints) => {
        setNetwork(network);
        setIsOpen(false);
    };

    const renderItem = (network: NetworkEndpoints) => {
        const isSelected = network.name === currentNetwork.name;
        return (
            <button
                key={network.name}
                className={isSelected ? `${styles.popoverItem} ${styles.popoverItemSelected}` : styles.popoverItem}
                onClick={() => selectNetwork(network)}
            >
                <span className={styles.popoverItemText}>
                    <span className={styles.popoverItemName}>{network.name}</span>
                    <span className={styles.popoverItemEndpoint}>{network.rest}</span>
                </span>
                {isSelected && (
                    <span className={styles.popoverItemCheck}>
                        <CheckIcon />
                    </span>
                )}
            </button>
        );
    };

    return (
        <div className={styles.switcherWrap} ref={containerRef}>
            {isOpen && (
                <div className={styles.popover}>
                    {availableNetworks.map(renderItem)}
                    {discoveredNetworks.length > 0 && (
                        <>
                            <div className={`section-label ${styles.popoverSection}`}>Discovered</div>
                            {discoveredNetworks.map(renderItem)}
                        </>
                    )}
                </div>
            )}

            <button
                type="button"
                className={styles.statusChip}
                onClick={() => setIsOpen(open => !open)}
                title="Switch network"
            >
                <span className={styles.statusDot} />
                <span className={styles.statusStack}>
                    <span className={styles.statusName}>{currentNetwork.name}</span>
                    {latestBlockHeight !== null && (
                        <span className={styles.statusBlock}>Block #{Number(latestBlockHeight).toLocaleString()}</span>
                    )}
                </span>
                <span className={styles.statusChevron}>
                    <ChevronUpIcon />
                </span>
            </button>
        </div>
    );
};

interface SidebarProps {
    drawerOpen: boolean;
    onCloseDrawer: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ drawerOpen, onCloseDrawer }) => {
    const location = useLocation();

    const isLobby = location.pathname === "/";
    const isWallet = location.pathname === "/wallet";
    const isHandHistory = location.pathname === "/hand-history";
    const isPlayers = location.pathname === "/players" || location.pathname.startsWith("/players/");
    const isExplorer = location.pathname === "/explorer";
    const isHandDistribution = location.pathname === "/hand-distribution";
    const isNodes = location.pathname === "/nodes";
    const isTechNotes = location.pathname === "/tech-notes";

    // Route change closes the mobile drawer.
    useEffect(() => {
        onCloseDrawer();
    }, [location.pathname, onCloseDrawer]);

    return (
        <>
            {drawerOpen && <div className={styles.backdrop} onClick={onCloseDrawer} />}
            <aside className={drawerOpen ? `${styles.sidebar} ${styles.sidebarOpen}` : styles.sidebar}>
                <button
                    type="button"
                    className={styles.drawerClose}
                    onClick={onCloseDrawer}
                    aria-label="Close navigation"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M18 6 6 18" />
                        <path d="m6 6 12 12" />
                    </svg>
                </button>
                <Link to="/" className={styles.brand}>
                    <img className={styles.brandMark} src={logoUrl} alt="Block52" width={36} height={36} />
                    <span className={styles.brandText}>
                        <span className={styles.brandName}>Block52</span>
                        <span className={styles.brandSub}>Poker VM</span>
                    </span>
                </Link>

                <span className={`section-label ${styles.groupLabel}`}>Play</span>
                <NavItem to="/" active={isLobby} icon="lobby" label="Lobby" />
                <NavItem to="/wallet" active={isWallet} icon="wallet" label="Wallet" />
                <NavItem to="/hand-history" active={isHandHistory} icon="history" label="Hand history" />
                <NavItem to="/players" active={isPlayers} icon="players" label="Players" />

                <span className={`section-label ${styles.groupLabelNetwork}`}>Network</span>
                <NavItem to="/explorer" active={isExplorer} icon="explorer" label="Block explorer" />
                <NavItem to="/hand-distribution" active={isHandDistribution} icon="distribution" label="Hand distribution" />
                <NavItem to="/nodes" active={isNodes} icon="nodes" label="Nodes" />
                <NavItem to="/tech-notes" active={isTechNotes} icon="notes" label="Tech notes" />

                <div className={styles.spacer} />

                <NavItem icon="admin" label="Admin" />

                <NetworkSwitcher />
            </aside>
        </>
    );
};

export default Sidebar;
