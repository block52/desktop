const CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
const GENERATORS = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];

function polymod(values: number[]): number {
    let checksum = 1;
    for (const value of values) {
        const top = checksum >>> 25;
        checksum = ((checksum & 0x1ffffff) << 5) ^ value;
        for (let index = 0; index < 5; index += 1) {
            if ((top >>> index) & 1) checksum ^= GENERATORS[index];
        }
    }
    return checksum >>> 0;
}

/** True when `address` is a well-formed bech32 string (checksum included) with the given prefix and a 20- or 32-byte payload. */
export function isValidBech32Address(address: string, prefix: string): boolean {
    if (address !== address.toLowerCase() || address.length < 8 || address.length > 90) return false;
    const separator = address.lastIndexOf("1");
    if (separator < 1 || address.slice(0, separator) !== prefix) return false;
    const data: number[] = [];
    for (const character of address.slice(separator + 1)) {
        const value = CHARSET.indexOf(character);
        if (value === -1) return false;
        data.push(value);
    }
    if (data.length < 6) return false;
    const expanded = [...prefix].map(character => character.charCodeAt(0) >> 5);
    expanded.push(0, ...[...prefix].map(character => character.charCodeAt(0) & 31));
    if (polymod([...expanded, ...data]) !== 1) return false;
    const payloadBits = (data.length - 6) * 5;
    const payloadBytes = Math.floor(payloadBits / 8);
    return payloadBytes === 20 || payloadBytes === 32;
}
