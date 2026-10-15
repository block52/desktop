import { QRCodeSVG } from "qrcode.react";
import usdcUrl from "../../assets/lobby/usdc.svg";
import CopyButton from "../copyButton/CopyButton";
import type { WalletTab } from "./DepositWithdrawPanel";
import styles from "./AvailableCard.module.css";

interface AvailableCardProps {
    usdcBalanceMicro: string;
    pendingWithdrawalMicro: string;
    address: string;
    web3Address: string | null;
    isWeb3Connected: boolean;
    tab: WalletTab;
    onTabChange: (tab: WalletTab) => void;
    onSend: () => void;
    onManageWeb3: () => void;
    onShowKeys: () => void;
    onRefresh: () => void;
    isRefreshing: boolean;
}

function microToUsd(micro: string): string {
    return (Number(micro) / 1_000_000).toFixed(2);
}

const AvailableCard: React.FC<AvailableCardProps> = ({
    usdcBalanceMicro,
    pendingWithdrawalMicro,
    address,
    web3Address,
    isWeb3Connected,
    tab,
    onTabChange,
    onSend,
    onManageWeb3,
    onShowKeys,
    onRefresh,
    isRefreshing
}) => {
    const shortAddress = `${address.slice(0, 3)}…${address.slice(-4)}`;
    const web3Short = web3Address ? `${web3Address.slice(0, 6)}…${web3Address.slice(-4)}` : "";

    return (
        <div className={`pane-lite ${styles.card}`}>
            <div className={styles.cardHead}>
                <span className="section-label">Available</span>
                <span className={styles.headRight}>
                    <span className={styles.headAddress}>{shortAddress}</span>
                    <CopyButton text={address} message="Address copied" title="Copy address" />
                    <button
                        className={styles.iconButton}
                        title="Refresh"
                        aria-label="Refresh balance and activity"
                        onClick={onRefresh}
                        disabled={isRefreshing}
                    >
                        <svg
                            className={isRefreshing ? styles.spinning : undefined}
                            width="13"
                            height="13"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            viewBox="0 0 24 24"
                        >
                            <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
                            <path d="M21 3v5h-5" />
                        </svg>
                    </button>
                    <button
                        className={styles.iconButton}
                        title="Wallet keys"
                        aria-label="Wallet keys"
                        onClick={onShowKeys}
                    >
                        <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </button>
                </span>
            </div>

            <div className={styles.balanceRow}>
                <img src={usdcUrl} alt="USDC" className={styles.usdcIcon} />
                <span className={styles.balanceAmount}>${microToUsd(usdcBalanceMicro)}</span>
            </div>

            <div className={styles.breakdown}>
                <div className={styles.breakdownRow}>
                    <span>Pending withdrawal</span>
                    <span className={styles.breakdownValue}>-${microToUsd(pendingWithdrawalMicro)}</span>
                </div>
            </div>

            <div className={styles.actionsRow}>
                <div className="segmented">
                    <button
                        className={tab === "deposit" ? "seg on" : "seg"}
                        onClick={() => onTabChange("deposit")}
                    >
                        Deposit
                    </button>
                    <button
                        className={tab === "withdraw" ? "seg on" : "seg"}
                        onClick={() => onTabChange("withdraw")}
                    >
                        Withdraw
                    </button>
                </div>
                <button className={`btn-ghost ${styles.pill}`} onClick={onSend}>
                    Send
                </button>
            </div>

            <div className={styles.receive}>
                <div className={styles.qr}>
                    <QRCodeSVG value={address} size={132} level="M" marginSize={2} />
                </div>
                <div className={styles.receiveText}>
                    <span className="section-label">Receive</span>
                    <span className={styles.receiveHint}>Scan from another Block52 wallet, or copy the address, to send b52USDC here.</span>
                    <span className={styles.receiveAddress}>
                        <code>{address}</code>
                        <CopyButton text={address} message="Address copied" title="Copy full address" />
                    </span>
                </div>
            </div>

            {isWeb3Connected && web3Address && (
                <div className={styles.web3Row}>
                    <span className={styles.web3Dot} aria-hidden="true" />
                    <div className={styles.web3Info}>
                        <span className="section-label">Connected Web3 wallet</span>
                        <span className={styles.web3Address} title={web3Address}>
                            {web3Short}
                            <CopyButton text={web3Address} message="Address copied" title="Copy Web3 address" />
                        </span>
                    </div>
                    <button
                        className={`btn-ghost ${styles.pill} ${styles.web3Manage}`}
                        title="Switch network or disconnect this wallet"
                        onClick={onManageWeb3}
                    >
                        Manage wallet
                    </button>
                </div>
            )}
        </div>
    );
};

export default AvailableCard;
