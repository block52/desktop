export const withdrawAbi = [
    {
        inputs: [
            { internalType: "uint256", name: "amount",    type: "uint256"  },
            { internalType: "address", name: "receiver",  type: "address"  },
            { internalType: "bytes32", name: "nonce",     type: "bytes32"  },
            { internalType: "bytes",   name: "signature", type: "bytes"    }
        ],
        name: "withdraw",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function"
    }
] as const;

export const BRIDGE_ADDRESS = "0xE4E22A524f2b104cB71fB154f72736bd02722fF4";
