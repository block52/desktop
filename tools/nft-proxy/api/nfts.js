// Vercel entry point: the same handler the Cloudflare Worker uses.
//   GET https://<project>.vercel.app/api/nfts?owner=0x…
import { handleRequest } from "../worker.js";

function run(request) {
    return handleRequest(request, { ALCHEMY_KEY: process.env.ALCHEMY_KEY });
}

export const GET = run;
export const OPTIONS = run;
