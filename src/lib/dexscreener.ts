import { TOKEN } from "@/lib/token";

export type TokenPriceSnapshot = {
  priceUsd: number;
  change24h: number;
  marketCap: number;
  volume24h: number;
  liquidityUsd: number;
  pairUrl: string;
};

type DexscreenerPair = {
  chainId?: string;
  url?: string;
  priceUsd?: string;
  priceChange?: { h24?: number };
  liquidity?: { usd?: number };
  marketCap?: number;
  fdv?: number;
  volume?: { h24?: number };
};

type DexscreenerResponse = {
  pairs?: DexscreenerPair[];
};

const ENDPOINT = `https://api.dexscreener.com/latest/dex/tokens/${TOKEN.address}`;

/**
 * Fetch the most liquid pair on Base for $aeonterminal and normalise the
 * fields we display. Returns `null` on any failure so callers can hide the
 * widget gracefully without showing a broken state.
 */
export async function fetchTokenPrice(
  signal?: AbortSignal,
): Promise<TokenPriceSnapshot | null> {
  try {
    const res = await fetch(ENDPOINT, {
      signal,
      headers: { accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as DexscreenerResponse;
    const pairs = data.pairs ?? [];
    if (pairs.length === 0) return null;

    const basePairs = pairs.filter((p) => p.chainId === "base");
    const pool = basePairs.length > 0 ? basePairs : pairs;
    const best = pool.reduce<DexscreenerPair>((a, b) => {
      const al = a.liquidity?.usd ?? 0;
      const bl = b.liquidity?.usd ?? 0;
      return bl > al ? b : a;
    }, pool[0]);

    const priceUsd = Number.parseFloat(best.priceUsd ?? "0");
    if (!Number.isFinite(priceUsd) || priceUsd <= 0) return null;

    return {
      priceUsd,
      change24h: best.priceChange?.h24 ?? 0,
      marketCap: best.marketCap ?? best.fdv ?? 0,
      volume24h: best.volume?.h24 ?? 0,
      liquidityUsd: best.liquidity?.usd ?? 0,
      pairUrl: best.url ?? TOKEN.dexscreenerUrl,
    };
  } catch {
    return null;
  }
}

export function formatPriceUsd(price: number): string {
  if (price >= 1) return `$${price.toFixed(4)}`;
  if (price >= 0.01) return `$${price.toFixed(5)}`;
  if (price >= 0.0001) return `$${price.toFixed(6)}`;
  if (price >= 0.000001) return `$${price.toFixed(8)}`;
  return `$${price.toExponential(2)}`;
}

export function formatCompactUsd(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "$0";
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

export function formatPercentChange(pct: number): string {
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}
