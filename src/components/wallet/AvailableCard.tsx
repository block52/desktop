import usdcUrl from "../../assets/lobby/usdc.svg";
import { SlidingTabs } from "@block52/ui-sdk";
import { CopyButton } from "@block52/ui-sdk";
import { otherHoldings } from "../../config/ethTokens";
import type { EthAccount } from "../../hooks/wallet/useEthAccount";
import AddressPill from "./AddressPill";
import type { WalletTab } from "./DepositWithdrawPanel";
import styles from "./AvailableCard.module.css";

interface AvailableCardProps {
    usdcBalanceMicro: string;
    /** True once the Block52 balance has loaded; false while loading or after a failed fetch. */
    usdcLoaded: boolean;
    /** Non-empty when the Block52 balance could not be read; shown as a tooltip on the "—". */
    usdcError: string;
    /** The Block52 address. */
    address: string;
    /** The Ethereum wallet derived from the same seed phrase. */
    eth: EthAccount;
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

function microToUsd(micro: string | bigint): string {
    // Cut to cents rather than round, so the card never shows more than is held.
    const value = typeof micro === "bigint" ? micro : BigInt(micro);
    const cents = value / 10_000n;
    return `${cents / 100n}.${(cents % 100n).toString().padStart(2, "0")}`;
}

/** The Ethereum wallet's USDC; "…" while loading, "—" when it could not be read. */
function ethUsdc(eth: EthAccount): string {
    if (eth.balances !== null) return `$${microToUsd(eth.balances.usdc)}`;
    return eth.error !== "" ? "—" : "…";
}

/** The Block52 USDC; "…" while loading, "—" when it could not be read (so a failed load isn't shown as $0.00). */
function block52Usdc(loaded: boolean, error: string, micro: string): string {
    if (loaded) return `$${microToUsd(micro)}`;
    return error !== "" ? "—" : "…";
}

/** Both of the user's wallets: Block52 and the Ethereum wallet derived from the same seed phrase. */
const AvailableCard: React.FC<AvailableCardProps> = ({
    usdcBalanceMicro,
    usdcLoaded,
    usdcError,
    address,
    eth,
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
    const holdings = eth.balances === null ? [] : otherHoldings(eth.balances);
    return (
        <div className={`pane-lite ${styles.card}`}>
            <div className={styles.cardHead}>
                <h2 className={styles.title}>Available</h2>
                <span className={styles.headRight}>
                    <button
                        className={styles.iconButton}
                        title="Refresh"
                        aria-label="Refresh balances and activity"
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
                    <button className={styles.iconButton} title="Wallet keys" aria-label="Wallet keys" onClick={onShowKeys}>
                        <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </button>
                </span>
            </div>

            <div className={styles.balances}>
                <div className={styles.balanceRow}>
                    <img src={usdcUrl} alt="" className={styles.usdcIcon} />
                    <span className={styles.balanceLabel}>Block52 USDC</span>
                    <span className={styles.balanceAmount} title={usdcError !== "" ? usdcError : undefined}>
                        {block52Usdc(usdcLoaded, usdcError, usdcBalanceMicro)}
                    </span>
                </div>
                {eth.available && (
                    <div className={styles.balanceRow}>
                        <img src={usdcUrl} alt="" className={styles.usdcIcon} />
                        <span className={styles.balanceLabel}>Ethereum USDC</span>
                        <span className={styles.balanceAmount} title={eth.error !== "" ? eth.error : undefined}>
                            {ethUsdc(eth)}
                        </span>
                    </div>
                )}
                {holdings.length > 0 && <p className={styles.alsoHolds}>also holds {holdings.join(" · ")}</p>}
            </div>

            <div className={styles.actionsRow}>
                <SlidingTabs
                    label="Wallet action"
                    options={[
                        { value: "deposit", label: "Deposit" },
                        { value: "withdraw", label: "Withdraw" }
                    ]}
                    value={tab}
                    onChange={onTabChange}
                />
                <button className={`btn-ghost ${styles.pill}`} onClick={onSend}>
                    Send
                </button>
            </div>

            <div className={styles.addresses}>
                <div className={styles.addressField}>
                    <span className={styles.addressLabel}>Block52 address</span>
                    <AddressPill address={address} copyMessage="Block52 address copied" copyTitle="Copy Block52 address" />
                </div>
                {eth.address !== null && (
                    <div className={styles.addressField}>
                        <span className={styles.addressLabel}>Ethereum address</span>
                        <AddressPill address={eth.address} copyMessage="Ethereum address copied" copyTitle="Copy Ethereum address" />
                    </div>
                )}
            </div>

            {isWeb3Connected && web3Address && (
                <div className={styles.web3Row}>
                    <span className={styles.web3Dot} aria-hidden="true" />
                    <div className={styles.web3Info}>
                        <span className="section-label">External Web3 wallet</span>
                        <span className={styles.web3Address} title={web3Address}>
                            {web3Address}
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
