/** A validator's `withdrawal_signature` reply: read-only, nothing is written to the chain. */
interface WithdrawalSignatureReply {
    receiver: string;
    amount: string;
    nonce: string;
    signature: string;
}

export interface WithdrawalToSign {
    nonce: string;
    baseAddress: string;
    amount: string;
}

function isReply(value: unknown): value is WithdrawalSignatureReply {
    if (typeof value !== "object" || value === null) return false;
    const r = value as Record<string, unknown>;
    return typeof r.receiver === "string" && typeof r.amount === "string" && typeof r.nonce === "string" && typeof r.signature === "string";
}

/**
 * Asks the node for a validator's signature on a withdrawal. The reply is only accepted when it is for exactly
 * this receiver, amount and nonce, so a node cannot hand back a signature for something else. Whether the signer
 * is a whitelisted validator is the bridge contract's decision.
 */
export async function fetchWithdrawalSignature(rest: string, withdrawal: WithdrawalToSign): Promise<string> {
    const base = rest.replace(/\/+$/, "");
    const response = await fetch(`${base}/block52/pokerchain/poker/v1/withdrawal_signature/${encodeURIComponent(withdrawal.nonce)}`);
    if (!response.ok) throw new Error(`No validator signature yet (HTTP ${response.status})`);
    const reply: unknown = await response.json();
    if (!isReply(reply)) throw new Error("Unexpected reply from the validator");
    if (reply.nonce.toLowerCase() !== withdrawal.nonce.toLowerCase()) throw new Error("Signature is for a different withdrawal");
    if (reply.receiver.toLowerCase() !== withdrawal.baseAddress.toLowerCase()) throw new Error("Signature pays a different address");
    if (reply.amount !== withdrawal.amount) throw new Error("Signature is for a different amount");
    if (!/^0x[0-9a-fA-F]{130}$/.test(reply.signature)) throw new Error("Malformed signature");
    return reply.signature;
}

/** A withdrawal error the player can act on, in place of the wallet's or the contract's raw message. */
export function describeWithdrawError(message: string): string {
    if (/nonce already used/i.test(message)) return "This withdrawal has already been paid out on Ethereum. Check your receiving wallet.";
    if (/user rejected|denied|rejected the request/i.test(message)) return "You rejected the transaction in your wallet.";
    if (/insufficient funds/i.test(message)) return "Your wallet needs some ETH on Ethereum mainnet to pay the network fee.";
    if (/invalid signature/i.test(message)) return "The bridge did not accept the validator's signature.";
    if (/unknown rpc error|internal error|execution reverted/i.test(message)) {
        return "Your wallet could not send the transaction. Make sure it is on Ethereum mainnet and has ETH for the network fee, then try again.";
    }
    return message.split("\n")[0];
}
