import { useEffect, useState } from "react";
import type { GameEvent } from "../bus/types";

const VISIBLE_MS = 2500;

/** True for a couple of seconds after the local player's own seat join lands (other players' joins show nothing). */
export function useSeatJoinNotice(events: GameEvent[], localAddress: string | null): boolean {
    const [isVisible, setIsVisible] = useState(false);
    const [handledEvents, setHandledEvents] = useState<GameEvent[] | null>(null);

    const joinedSelf =
        localAddress !== null &&
        events.some(event => event.type === "playerJoined" && event.address.toLowerCase() === localAddress);

    // Adjusting state while rendering: each new batch of events is acted on once.
    if (joinedSelf && handledEvents !== events) {
        setHandledEvents(events);
        setIsVisible(true);
    }

    useEffect(() => {
        if (!isVisible) return;
        const timer = setTimeout(() => setIsVisible(false), VISIBLE_MS);
        return () => clearTimeout(timer);
    }, [isVisible]);

    return isVisible;
}
