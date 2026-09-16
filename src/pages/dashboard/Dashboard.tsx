import React, { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import GameWallet from "../../components/gameWallet/GameWallet";
import SendModal from "../../components/modal/SendModal";
import WithdrawModal from "../../components/modal/WithdrawModal";
import { useCosmosWallet } from "../../hooks/useCosmosWallet";
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

const RPC_ENDPOINT =
  import.meta.env.VITE_RPC_ENDPOINT ?? "http://localhost:26657";
const REST_ENDPOINT =
  import.meta.env.VITE_REST_ENDPOINT ?? "http://localhost:1317";

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { address: cosmosAddress, balance, refreshBalance } = useCosmosWallet();

  const [showSendModal, setShowSendModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);

  const goToWallet = useCallback(() => navigate("/wallet"), [navigate]);

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
          rpcEndpoint: RPC_ENDPOINT,
          restEndpoint: REST_ENDPOINT,
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
    [],
  );

  return (
    <div className={styles.page}>
      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <GameWallet
            cosmosAddress={cosmosAddress}
            usdcBalance={
              balance.find((b) => b.denom === COSMOS_CONSTANTS.TOKEN_DENOM)
                ?.amount ?? "0"
            }
            onDeposit={goToWallet}
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
          usdcBalance={
            balance.find((b) => b.denom === COSMOS_CONSTANTS.TOKEN_DENOM)
              ?.amount ?? "0"
          }
          onSend={handleSend}
          onClose={() => setShowSendModal(false)}
        />
      )}

      {showWithdrawModal && (
        <WithdrawModal
          usdcBalance={
            balance.find((b) => b.denom === COSMOS_CONSTANTS.TOKEN_DENOM)
              ?.amount ?? "0"
          }
          onClose={() => setShowWithdrawModal(false)}
        />
      )}
    </div>
  );
};

export default Dashboard;
