import React, { useEffect, useRef, useState } from "react";
import { useNetwork } from "../../context/NetworkContext";
import type { NetworkEndpoints } from "../../context/NetworkContext";
import styles from "./NetworkSelector.module.css";

const GlobeIcon: React.FC = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
    </svg>
);

const ChevronIcon: React.FC<{ open: boolean }> = ({ open }) => (
    <svg
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={open ? styles.chevronOpen : styles.chevron}
    >
        <polyline points="6 9 12 15 18 9" />
    </svg>
);

const CheckIcon: React.FC = () => (
    <svg className={styles.checkIcon} width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
        <path
            fillRule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clipRule="evenodd"
        />
    </svg>
);

function NetworkItem({ network, isSelected, onSelect }: { network: NetworkEndpoints; isSelected: boolean; onSelect: () => void }) {
    return (
        <button className={`${styles.item} ${isSelected ? styles.itemSelected : ""}`} onClick={onSelect}>
            <div className={styles.itemHeader}>
                <span className={styles.itemName}>{network.name}</span>
                {isSelected && <CheckIcon />}
            </div>
            <div className={styles.itemEndpoint}>{network.rest}</div>
        </button>
    );
}

export const NetworkSelector: React.FC = () => {
    const { currentNetwork, setNetwork, availableNetworks, discoveredNetworks } = useNetwork();
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

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

    return (
        <div className={styles.container} ref={containerRef}>
            <button className={styles.trigger} onClick={() => setIsOpen(open => !open)}>
                <GlobeIcon />
                <span>{currentNetwork.name}</span>
                <ChevronIcon open={isOpen} />
            </button>

            {isOpen && (
                <div className={styles.menu}>
                    {availableNetworks.map(network => (
                        <NetworkItem
                            key={network.name}
                            network={network}
                            isSelected={network.name === currentNetwork.name}
                            onSelect={() => selectNetwork(network)}
                        />
                    ))}

                    {discoveredNetworks.length > 0 && (
                        <>
                            <div className={styles.sectionHeader}>Discovered</div>
                            {discoveredNetworks.map(network => (
                                <NetworkItem
                                    key={network.name}
                                    network={network}
                                    isSelected={network.name === currentNetwork.name}
                                    onSelect={() => selectNetwork(network)}
                                />
                            ))}
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default NetworkSelector;
