import React, { useEffect, useState } from "react";
import { useAppKit, useAppKitAccount } from "@reown/appkit/react";
import { useSignMessage } from "wagmi";
import { useNetwork } from "../../context/NetworkContext";
import { useToast } from "../../context/ToastContext";
import {
    assertNftAuthorizationSigner,
    buildNftAuthorizationMessage,
    fetchWalletNfts,
    isEthAddress,
    nftIndexerUrl,
    registerNftAvatar,
    type OnChainNftAvatar,
    type WalletNftAsset
} from "../../utils/nftAvatar";
import styles from "./AvatarPickerModal.module.css";

interface AvatarPickerModalProps {
    cosmosAddress: string;
    /** The avatar currently registered on chain, if any. */
    current: OnChainNftAvatar | null;
    onClose: () => void;
    /** A new avatar was registered. */
    onRegistered: () => void;
}

export const AvatarPickerModal: React.FC<AvatarPickerModalProps> = ({ cosmosAddress, current, onClose, onRegistered }) => {
    const { currentNetwork } = useNetwork();
    const { showSuccess, showError } = useToast();
    const { open: openAppKit } = useAppKit();
    const { address: web3Address, isConnected } = useAppKitAccount();
    const { signMessageAsync } = useSignMessage();

    // Whose NFTs to list: a typed address, else the connected wallet, else the one already linked on chain.
    const [typedAddress, setTypedAddress] = useState("");
    const [browseAddress, setBrowseAddress] = useState<string | null>(null);
    const connectedAddress = isConnected && web3Address !== undefined ? web3Address : null;
    const viewAddress = browseAddress ?? connectedAddress ?? (current !== null ? current.ethAddress : null);

    const [nfts, setNfts] = useState<WalletNftAsset[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [loadError, setLoadError] = useState("");
    const [search, setSearch] = useState("");
    const [registeringId, setRegisteringId] = useState<string | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);

    const sourceConfigured = viewAddress === null || nftIndexerUrl(viewAddress) !== null;

    useEffect(() => {
        if (viewAddress === null || !sourceConfigured) return;
        const controller = new AbortController();
        setIsLoading(true);
        setLoadError("");
        fetchWalletNfts(viewAddress, controller.signal)
            .then(setNfts)
            .catch(err => {
                if (controller.signal.aborted) return;
                setNfts([]);
                setLoadError(err instanceof Error ? err.message : "Could not load NFTs");
            })
            .finally(() => {
                if (!controller.signal.aborted) setIsLoading(false);
            });
        return () => controller.abort();
    }, [viewAddress, sourceConfigured, refreshKey]);

    const submitAddress = (event: React.FormEvent) => {
        event.preventDefault();
        const next = typedAddress.trim();
        if (next === "") {
            setBrowseAddress(null);
            return;
        }
        if (!isEthAddress(next)) {
            setLoadError("Enter an Ethereum address (0x followed by 40 hex characters).");
            return;
        }
        setBrowseAddress(next);
    };

    const choose = async (asset: WalletNftAsset) => {
        if (connectedAddress === null) {
            void openAppKit();
            return;
        }
        setRegisteringId(asset.id);
        try {
            const message = buildNftAuthorizationMessage(connectedAddress, cosmosAddress, asset.contractAddress, asset.tokenId);
            const signature = await signMessageAsync({ message });
            assertNftAuthorizationSigner(message, signature, connectedAddress);
            await registerNftAvatar(currentNetwork, connectedAddress, asset.contractAddress, asset.tokenId, signature);
            showSuccess("Avatar registered — it shows at your next table");
            onRegistered();
            onClose();
        } catch (err) {
            showError(err instanceof Error ? err.message : "Could not register the avatar");
        } finally {
            setRegisteringId(null);
        }
    };

    const needle = search.trim().toLowerCase();
    const visible = needle === "" ? nfts : nfts.filter(asset => `${asset.name ?? ""} ${asset.collectionName ?? ""} ${asset.tokenId}`.toLowerCase().includes(needle));

    return (
        <div className={styles.overlay} onClick={registeringId === null ? onClose : undefined} role="presentation">
            <div className={styles.modal} role="dialog" aria-modal="true" aria-label="Choose NFT avatar" onClick={e => e.stopPropagation()}>
                <h2 className={styles.title}>Choose your table avatar</h2>
                <p className={styles.body}>
                    Pick an NFT you own. Your Ethereum wallet signs once to authorise your Block52 address to show it; no gas and no transfer.
                </p>

                {current !== null && (
                    <p className={styles.current}>
                        Registered now: {current.contractAddress.slice(0, 8)}…{current.contractAddress.slice(-4)} #{current.tokenId}, linked to{" "}
                        {current.ethAddress.slice(0, 6)}…{current.ethAddress.slice(-4)}
                    </p>
                )}

                <div className={styles.walletRow}>
                    {connectedAddress !== null ? (
                        <span className={styles.connected}>Signing wallet: {connectedAddress.slice(0, 6)}…{connectedAddress.slice(-4)}</span>
                    ) : (
                        <button type="button" className={`btn-glow ${styles.connect}`} onClick={() => void openAppKit()}>
                            Connect Ethereum wallet
                        </button>
                    )}
                    <form className={styles.addressForm} onSubmit={submitAddress}>
                        <input
                            className={styles.input}
                            value={typedAddress}
                            onChange={e => setTypedAddress(e.target.value)}
                            placeholder="Browse another address (0x…)"
                            aria-label="Ethereum address to browse"
                        />
                        <button type="submit" className={`btn-ghost ${styles.view}`}>
                            View
                        </button>
                    </form>
                </div>

                {!sourceConfigured && (
                    <p className={styles.note}>No NFT source configured. Set VITE_PROFILE_NFT_INDEXER_URL (or an Alchemy VITE_MAINNET_RPC_URL) to list NFTs.</p>
                )}
                {viewAddress === null && sourceConfigured && <p className={styles.note}>Connect your Ethereum wallet, or paste an address, to list its NFTs.</p>}
                {isLoading && <p className={styles.note}>Scanning wallet NFTs…</p>}
                {loadError !== "" && <p className={styles.error}>{loadError}</p>}
                {viewAddress !== null && !isLoading && loadError === "" && sourceConfigured && nfts.length === 0 && (
                    <p className={styles.note}>No NFTs found for this address.</p>
                )}

                {nfts.length > 0 && (
                    <input className={styles.input} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, collection or token ID" />
                )}

                <div className={styles.grid}>
                    {visible.map(asset => {
                        const isCurrent =
                            current !== null && current.contractAddress.toLowerCase() === asset.contractAddress.toLowerCase() && current.tokenId === asset.tokenId;
                        return (
                            <button
                                key={asset.id}
                                type="button"
                                className={`${styles.card} ${isCurrent ? styles.cardCurrent : ""}`}
                                onClick={() => void choose(asset)}
                                disabled={registeringId !== null}
                                title={connectedAddress === null ? "Connect your wallet to use this" : "Use as my avatar"}
                            >
                                <img src={asset.imageUrl} alt={asset.name ?? `NFT #${asset.tokenId}`} className={styles.image} loading="lazy" />
                                <span className={styles.meta}>
                                    {asset.collectionName ?? "Collection"} · #{asset.tokenId}
                                    {isCurrent ? " · current" : ""}
                                </span>
                                {registeringId === asset.id && <span className={styles.registering}>Waiting for signature…</span>}
                            </button>
                        );
                    })}
                </div>

                <div className={styles.actions}>
                    <button type="button" className={`btn-ghost ${styles.action}`} onClick={() => setRefreshKey(key => key + 1)} disabled={isLoading || viewAddress === null}>
                        Refresh
                    </button>
                    <button type="button" className={`btn-ghost ${styles.action}`} onClick={onClose} disabled={registeringId !== null}>
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AvatarPickerModal;
