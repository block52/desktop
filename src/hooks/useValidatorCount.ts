import { useEffect, useState } from "react";
import { useNetwork } from "../context/NetworkContext";

/** Size of the latest Tendermint validator set, or null when unavailable. */
export function useValidatorCount(): number | null {
    const { currentNetwork } = useNetwork();
    const [count, setCount] = useState<number | null>(null);

    useEffect(() => {
        if (currentNetwork.rest === "") return;
        let cancelled = false;

        const load = async () => {
            try {
                const response = await fetch(`${currentNetwork.rest}/cosmos/base/tendermint/v1beta1/validatorsets/latest`);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const data = await response.json();
                if (cancelled) return;
                if (Array.isArray(data.validators)) {
                    setCount(data.validators.length);
                } else {
                    setCount(null);
                }
            } catch {
                if (!cancelled) setCount(null);
            }
        };

        void load();
        const interval = setInterval(load, 30000);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [currentNetwork]);

    return count;
}
