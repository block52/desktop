const KNOWN_REASONS: { match: RegExp; message: string }[] = [
    { match: /already claimed/i, message: "This prize was already collected." },
    { match: /insufficient/i, message: "Not enough funds for that." },
    { match: /sequence/i, message: "The network was busy. Please try again." },
    { match: /not (your|the player'?s?) turn|out of turn/i, message: "It's not your turn." },
    { match: /seat.*(taken|occupied)|already seated/i, message: "That seat is taken." },
    { match: /(not found|no such) (game|table)|game .* not found/i, message: "This table is no longer available." },
    { match: /timed? ?out|timeout/i, message: "The request timed out. Please try again." },
    { match: /network request failed|failed to fetch|econn|enotfound|network error/i, message: "Can't reach the network. Check your connection." },
    { match: /user rejected|cancel/i, message: "Cancelled." }
];

function errorText(err: unknown): string {
    if (typeof err === "object" && err !== null && "message" in err) return String((err as { message: unknown }).message);
    return String(err);
}

/** The chain's reason from a failed transaction: the text after "message index: N:", without hashes and addresses. */
function chainReason(message: string): string {
    const tail = message.split(/message index: \d+:/i).pop() ?? message;
    return tail
        .replace(/0x[0-9a-f]{16,}/gi, "")
        .replace(/\bb521[0-9a-z]{20,}\b/g, "")
        .replace(/\b[0-9A-F]{40,}\b/g, "")
        .replace(/\s+/g, " ")
        .replace(/^[\s:;,.-]+|[\s:;,.-]+$/g, "");
}

/** The chain refuses a second leave once a Sit & Go prize was settled: the seat is already gone. */
export function isPayoutAlreadyClaimed(err: unknown): boolean {
    return /already claimed/i.test(errorText(err));
}

/**
 * The message to show for a failed chain action: plain words for known causes, otherwise only the chain's short
 * reason (never the transaction hash, addresses or the full wrapped error).
 */
export function actionErrorMessage(err: unknown): string {
    const raw = errorText(err);
    for (const known of KNOWN_REASONS) {
        if (known.match.test(raw)) return known.message;
    }
    const reason = chainReason(raw);
    if (reason === "" || reason.length > 120) return "Something went wrong. Please try again.";
    return reason.charAt(0).toUpperCase() + reason.slice(1);
}
