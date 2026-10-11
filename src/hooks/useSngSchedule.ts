import { useEffect, useState } from "react";
import { parseSngSchedule, type SngTournament } from "../utils/sngSchedule";

/**
 * The recurring Sit & Go schedule lives in the web app's repo so it can be edited without a release.
 * Override with VITE_SNG_SCHEDULE_URL (e.g. to point at a branch).
 */
const DEFAULT_SCHEDULE_URL = "https://raw.githubusercontent.com/block52/ui/main/public/sng-schedule.json";

function scheduleUrl(): string {
    const configured: unknown = import.meta.env.VITE_SNG_SCHEDULE_URL;
    return typeof configured === "string" && configured !== "" ? configured : DEFAULT_SCHEDULE_URL;
}

export interface SngScheduleState {
    tournaments: SngTournament[];
    isLoading: boolean;
    error: string;
}

/** Fetch and validate the weekly recurring Sit & Go schedule. */
export function useSngSchedule(): SngScheduleState {
    const [state, setState] = useState<SngScheduleState>({ tournaments: [], isLoading: true, error: "" });

    useEffect(() => {
        const controller = new AbortController();
        void (async () => {
            try {
                const response = await fetch(scheduleUrl(), { signal: controller.signal });
                if (!response.ok) throw new Error(`Schedule responded ${response.status}`);
                const tournaments = parseSngSchedule(await response.json());
                setState({ tournaments, isLoading: false, error: "" });
            } catch (err) {
                if (controller.signal.aborted) return;
                setState({ tournaments: [], isLoading: false, error: err instanceof Error ? err.message : "Failed to load the schedule" });
            }
        })();
        return () => controller.abort();
    }, []);

    return state;
}
