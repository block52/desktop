import React, { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import GameWallet from "../../components/gameWallet/GameWallet";
import SendModal from "../../components/modal/SendModal";
import WithdrawModal from "../../components/modal/WithdrawModal";
import DepositModal from "../../components/modal/DepositModal";
import { useCosmosWallet } from "../../hooks/useCosmosWallet";
import { useNetwork } from "../../context/NetworkContext";
import TableList from "../../components/tableList/TableList";
import {
  getCosmosMnemonic,
  getCosmosAddress,
} from "../../utils/cosmos/storage";
import {
  createSigningClientFromMnemonic,
  COSMOS_CONSTANTS,
} from "@block52/poker-vm-sdk";
import styles from "./Dashboard.module.css";

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { address: cosmosAddress, balance, refreshBalance } = useCosmosWallet();
  const { currentNetwork } = useNetwork();

  const [showSendModal, setShowSendModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);

  const goToWallet = useCallback(() => navigate("/wallet"), [navigate]);

  const usdcBalanceAmount =
    balance.find((b) => b.denom === COSMOS_CONSTANTS.TOKEN_DENOM)?.amount ?? "0";

  const avatarInitials = cosmosAddress
    ? cosmosAddress.slice(2, 4).toUpperCase()
    : null;

  const handleSend = useCallback(
    async (recipient: string, amountUsdc: number): Promise<string> => {
      const mnemonic = getCosmosMnemonic();
      const fromAddress = getCosmosAddress();

      if (!mnemonic || !fromAddress) {
        throw new Error(
          "No wallet found. Please create or import a wallet first.",
        );
      }

      const signingClient = await createSigningClientFromMnemonic(
        {
          rpcEndpoint: currentNetwork.rpc,
          restEndpoint: currentNetwork.rest,
          chainId: COSMOS_CONSTANTS.CHAIN_ID,
          prefix: COSMOS_CONSTANTS.ADDRESS_PREFIX,
          denom: COSMOS_CONSTANTS.GAS_DENOM,
          gasPrice: COSMOS_CONSTANTS.DEFAULT_GAS_PRICE,
        },
        mnemonic,
      );

      const amountMicro = BigInt(
        Math.floor(amountUsdc * Math.pow(10, COSMOS_CONSTANTS.USDC_DECIMALS)),
      );
      return signingClient.sendTokens(
        fromAddress,
        recipient,
        amountMicro,
        COSMOS_CONSTANTS.TOKEN_DENOM,
      );
    },
    [currentNetwork],
  );

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

      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <GameWallet
            cosmosAddress={cosmosAddress}
            usdcBalance={usdcBalanceAmount}
            onDeposit={() => setShowDepositModal(true)}
            onWithdraw={() => setShowWithdrawModal(true)}
            onSend={() => setShowSendModal(true)}
            onCreateWallet={goToWallet}
            onImportWallet={goToWallet}
            onRefresh={refreshBalance}
          />
        </aside>
        <main className={styles.main}>
          <TableList />
        </main>
      </div>

      {showSendModal && cosmosAddress && (
        <SendModal
          fromAddress={cosmosAddress}
          usdcBalance={usdcBalanceAmount}
          onSend={handleSend}
          onClose={() => setShowSendModal(false)}
        />
      )}

      {showWithdrawModal && (
        <WithdrawModal
          usdcBalance={usdcBalanceAmount}
          onClose={() => setShowWithdrawModal(false)}
        />
      )}

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
