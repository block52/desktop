import { useState } from "react";
import styles from "./BondValidatorForm.module.css";

export interface BondPayload {
    consensusPubkeyBase64: string;
    amountMicro: bigint;
    moniker: string;
    website: string;
    securityContact: string;
    details: string;
    commissionRate: string;
    commissionMaxRate: string;
    commissionMaxChangeRate: string;
}

interface BondValidatorFormProps {
    walletBalanceUsdc: number;
    minBondUsdc: number;
    totalBondedUsdc: number;
    onBond: (payload: BondPayload) => Promise<void> | void;
    isBonding: boolean;
    error: string;
    resultHash: string;
}

export interface BondFormValues {
    consensusKey: string;
    moniker: string;
    bondUsdc: number;
    commissionRate: number;
    commissionMaxRate: number;
    commissionMaxChangeRate: number;
    confirmedNode: boolean;
    confirmedUpgrade: boolean;
}

/** Accept the base64 key alone or the whole `show-validator` JSON. */
export function extractConsensusKey(raw: string): string {
    const trimmed = raw.trim();
    const match = /"key"\s*:\s*"([^"]+)"/.exec(trimmed);
    if (match !== null) return match[1];
    return trimmed;
}

export function votingPowerPercent(bondUsdc: number, totalBondedUsdc: number): number {
    const total = totalBondedUsdc + bondUsdc;
    if (total <= 0) return 0;
    return (bondUsdc / total) * 100;
}

function inZeroOne(value: number): boolean {
    return Number.isFinite(value) && value >= 0 && value <= 1;
}

export function validateBondForm(values: BondFormValues, walletBalanceUsdc: number, minBondUsdc: number): string {
    if (values.consensusKey === "") return "Consensus public key is required";
    if (values.moniker.trim() === "") return "Moniker is required";
    if (!Number.isFinite(values.bondUsdc) || values.bondUsdc <= 0) return "Enter a self-bond amount";
    if (values.bondUsdc < minBondUsdc) return `Minimum self-bond is ${minBondUsdc} USDC`;
    if (values.bondUsdc > walletBalanceUsdc) return "Self-bond exceeds your wallet balance";
    if (!inZeroOne(values.commissionRate)) return "Commission rate must be a decimal between 0 and 1";
    if (!inZeroOne(values.commissionMaxRate)) return "Max commission must be a decimal between 0 and 1";
    if (values.commissionMaxRate < values.commissionRate) return "Max commission can't be below the commission rate";
    if (!inZeroOne(values.commissionMaxChangeRate)) return "Max daily change must be a decimal between 0 and 1";
    if (values.commissionMaxChangeRate > values.commissionMaxRate) return "Max daily change can't exceed max commission";
    if (!values.confirmedNode || !values.confirmedUpgrade) return "Confirm both statements before bonding";
    return "";
}

const BondValidatorForm: React.FC<BondValidatorFormProps> = ({
    walletBalanceUsdc,
    minBondUsdc,
    totalBondedUsdc,
    onBond,
    isBonding,
    error,
    resultHash
}) => {
    const [consensusKeyRaw, setConsensusKeyRaw] = useState("");
    const [moniker, setMoniker] = useState("");
    const [bondRaw, setBondRaw] = useState("10");
    const [website, setWebsite] = useState("");
    const [securityContact, setSecurityContact] = useState("");
    const [details, setDetails] = useState("");
    const [commissionRate, setCommissionRate] = useState("0.10");
    const [commissionMaxRate, setCommissionMaxRate] = useState("0.20");
    const [commissionMaxChangeRate, setCommissionMaxChangeRate] = useState("0.01");
    const [confirmedNode, setConfirmedNode] = useState(false);
    const [confirmedUpgrade, setConfirmedUpgrade] = useState(false);
    const [formError, setFormError] = useState("");

    const consensusKey = extractConsensusKey(consensusKeyRaw);
    const bondUsdc = parseFloat(bondRaw) || 0;
    const power = votingPowerPercent(bondUsdc, totalBondedUsdc);

    const handleSubmit = () => {
        const message = validateBondForm(
            {
                consensusKey,
                moniker,
                bondUsdc,
                commissionRate: parseFloat(commissionRate) || 0,
                commissionMaxRate: parseFloat(commissionMaxRate) || 0,
                commissionMaxChangeRate: parseFloat(commissionMaxChangeRate) || 0,
                confirmedNode,
                confirmedUpgrade
            },
            walletBalanceUsdc,
            minBondUsdc
        );
        setFormError(message);
        if (message !== "") return;

        void onBond({
            consensusPubkeyBase64: consensusKey,
            amountMicro: BigInt(Math.round(bondUsdc * 1_000_000)),
            moniker: moniker.trim(),
            website: website.trim(),
            securityContact: securityContact.trim(),
            details: details.trim(),
            commissionRate,
            commissionMaxRate,
            commissionMaxChangeRate
        });
    };

    return (
        <div className={styles.layout}>
            <div className={`pane-lite ${styles.formCard}`}>
                <span className="section-label">Bond a validator</span>

                <div className={styles.field}>
                    <label className={styles.label}>Consensus public key</label>
                    <input
                        type="text"
                        value={consensusKeyRaw}
                        onChange={e => setConsensusKeyRaw(e.target.value)}
                        placeholder="Paste the output of pokerchaind comet show-validator"
                        className={`${styles.input} ${styles.inputMono}`}
                    />
                    <p className={styles.hint}>The whole JSON or just the key both work.</p>
                </div>

                <div className={styles.fieldRow}>
                    <div className={styles.field}>
                        <label className={styles.label}>Moniker (public name)</label>
                        <input
                            type="text"
                            value={moniker}
                            onChange={e => setMoniker(e.target.value)}
                            placeholder="e.g. MDAssets"
                            className={styles.input}
                        />
                    </div>
                    <div className={styles.field}>
                        <label className={styles.label}>Self-bond (USDC)</label>
                        <input
                            type="number"
                            value={bondRaw}
                            onChange={e => setBondRaw(e.target.value)}
                            placeholder="10"
                            min="0"
                            step="0.01"
                            className={styles.input}
                        />
                        <p className={styles.hint}>Your wallet has {walletBalanceUsdc.toFixed(2)} USDC</p>
                    </div>
                </div>

                <div className={styles.fieldRow}>
                    <div className={styles.field}>
                        <label className={styles.label}>Website (optional)</label>
                        <input
                            type="text"
                            value={website}
                            onChange={e => setWebsite(e.target.value)}
                            className={styles.input}
                        />
                    </div>
                    <div className={styles.field}>
                        <label className={styles.label}>Security contact (optional)</label>
                        <input
                            type="text"
                            value={securityContact}
                            onChange={e => setSecurityContact(e.target.value)}
                            className={styles.input}
                        />
                    </div>
                </div>

                <div className={styles.field}>
                    <label className={styles.label}>Details (optional)</label>
                    <input
                        type="text"
                        value={details}
                        onChange={e => setDetails(e.target.value)}
                        className={styles.input}
                    />
                </div>

                <div className={styles.fieldRow}>
                    <div className={styles.field}>
                        <label className={styles.label}>Commission</label>
                        <input
                            type="number"
                            value={commissionRate}
                            onChange={e => setCommissionRate(e.target.value)}
                            min="0"
                            max="1"
                            step="0.01"
                            className={styles.input}
                        />
                        <p className={styles.hint}>e.g. 0.10 = 10%</p>
                    </div>
                    <div className={styles.field}>
                        <label className={styles.label}>Max commission</label>
                        <input
                            type="number"
                            value={commissionMaxRate}
                            onChange={e => setCommissionMaxRate(e.target.value)}
                            min="0"
                            max="1"
                            step="0.01"
                            className={styles.input}
                        />
                        <p className={styles.hint}>Can't exceed 1</p>
                    </div>
                    <div className={styles.field}>
                        <label className={styles.label}>Max daily change</label>
                        <input
                            type="number"
                            value={commissionMaxChangeRate}
                            onChange={e => setCommissionMaxChangeRate(e.target.value)}
                            min="0"
                            max="1"
                            step="0.01"
                            className={styles.input}
                        />
                        <p className={styles.hint}>Can't exceed max commission</p>
                    </div>
                </div>

                <label className={styles.checkRow}>
                    <input
                        type="checkbox"
                        checked={confirmedNode}
                        onChange={e => setConfirmedNode(e.target.checked)}
                        className={styles.checkbox}
                    />
                    <span>
                        My node is running, fully synced (catching_up is false) and uses exactly this consensus
                        key. The key is on no other machine.
                    </span>
                </label>
                <label className={styles.checkRow}>
                    <input
                        type="checkbox"
                        checked={confirmedUpgrade}
                        onChange={e => setConfirmedUpgrade(e.target.checked)}
                        className={styles.checkbox}
                    />
                    <span>
                        I will upgrade pokerchaind with every release and follow coordinated halts. A validator
                        on the wrong binary drops out of consensus.
                    </span>
                </label>

                {(formError !== "" || error !== "") && (
                    <div className={styles.errorBanner}>{formError !== "" ? formError : error}</div>
                )}

                {resultHash !== "" && (
                    <div className={styles.successBanner}>
                        <p className={styles.successTitle}>Validator bonded</p>
                        <p className={styles.successHash}>Tx: {resultHash.slice(0, 18)}…</p>
                    </div>
                )}

                <button
                    className={`btn-glow shimmer-hover ${styles.bondButton}`}
                    onClick={handleSubmit}
                    disabled={isBonding}
                >
                    {isBonding ? "Bonding…" : "Bond validator"}
                </button>
            </div>

            <div className={`pane-lite ${styles.infoCard}`}>
                <span className="section-label">Before you bond</span>

                <div className={styles.infoBlock}>
                    <p className={styles.infoLead}>Sync first.</p>
                    <p className={styles.infoText}>
                        From the moment the bond lands, your node must be signing blocks. A bonded validator that
                        is offline counts against the network.
                    </p>
                </div>
                <div className={styles.infoBlock}>
                    <p className={styles.infoLead}>Downtime is penalised.</p>
                    <p className={styles.infoText}>
                        Missing more than half of any 100-block window slashes the validator and forfeits part of
                        the bond. Signing with the same key on two machines slashes more and bars the validator
                        permanently.
                    </p>
                </div>
                <div className={styles.infoBlock}>
                    <p className={styles.infoLead}>Unbonding takes 21 days.</p>
                </div>

                <div className={styles.powerBox}>
                    <p className={styles.infoText}>
                        If you bond {bondUsdc.toFixed(2)} USDC:{" "}
                        <span className={styles.powerValue}>{power.toFixed(2)}% of voting power</span>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default BondValidatorForm;
