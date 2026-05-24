export const TOKEN = {
  symbol: "AEON",
  address: "0xda3ffca86273037CdDCf71AAE2cDEa6aef313285",
  chain: "Base",
  buyUrl: "https://app.virtuals.io/virtuals/78419",
  scanUrl:
    "https://basescan.org/token/0xda3ffca86273037CdDCf71AAE2cDEa6aef313285",
  dexscreenerUrl:
    "https://dexscreener.com/base/0xda3ffca86273037CdDCf71AAE2cDEa6aef313285",
} as const;

export function shortAddress(addr: string, n = 6): string {
  if (addr.length <= 2 + n * 2) return addr;
  return `${addr.slice(0, 2 + n)}…${addr.slice(-n)}`;
}
