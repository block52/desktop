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

export const depositAbi = [
    {
        inputs: [
            { internalType: "uint256", name: "amount",   type: "uint256" },
            { internalType: "string",  name: "receiver", type: "string"  }
        ],
        name: "depositUnderlying",
        outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
        stateMutability: "nonpayable",
        type: "function"
    },
    {
        inputs: [
            { internalType: "uint256", name: "amount",   type: "uint256" },
            { internalType: "string",  name: "receiver", type: "string"  },
            { internalType: "address", name: "token",    type: "address" }
        ],
        name: "deposit",
        outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
        stateMutability: "nonpayable",
        type: "function"
    }
] as const;
