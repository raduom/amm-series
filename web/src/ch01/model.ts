// The chapter 1 model in TypeScript, for the page. The Haskell model is the reference.

export interface Pool {
  gold: number
  silver: number
}

export type Direction = 'GoldForSilver' | 'SilverForGold'

export interface Swap {
  direction: Direction
  amountIn: number
}

export type SwapError = 'AmountNotPositive' | 'InsufficientLiquidity'

export type Result =
  | { tag: 'Left'; error: SwapError }
  | { tag: 'Right'; amountOut: number; pool: Pool }

export const opposite = (d: Direction): Direction => (d === 'GoldForSilver' ? 'SilverForGold' : 'GoldForSilver')

export function swap({ direction, amountIn }: Swap, { gold, silver }: Pool): Result {
  const amountOut = amountIn
  const reserveOut = direction === 'GoldForSilver' ? silver : gold
  if (amountIn <= 0) return { tag: 'Left', error: 'AmountNotPositive' }
  if (amountOut > reserveOut) return { tag: 'Left', error: 'InsufficientLiquidity' }
  if (direction === 'GoldForSilver') {
    return { tag: 'Right', amountOut, pool: { gold: gold + amountIn, silver: silver - amountOut } }
  }
  return { tag: 'Right', amountOut, pool: { gold: gold - amountOut, silver: silver + amountIn } }
}

// Values written as Haskell, so they can stand in the code.
export const showInt = (n: number) => (n < 0 ? `(${n})` : `${n}`)
export const showPool = (p: Pool) => `Pool ${showInt(p.gold)} ${showInt(p.silver)}`
export const showSwap = (s: Swap) => `Swap ${s.direction} ${showInt(s.amountIn)}`
export const showResult = (r: Result) =>
  r.tag === 'Left' ? `Left ${r.error}` : `Right (${r.amountOut}, ${showPool(r.pool)})`
