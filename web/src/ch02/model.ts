// The chapter 2 model in TypeScript, for the page. The Haskell model is the reference.

export interface Pool {
  gold: number
  silver: number
}

export type Direction = 'GoldForSilver' | 'SilverForGold'

export interface Swap {
  direction: Direction
  amountIn: number
  minAmountOut: number
}

export type SwapError = 'AmountNotPositive' | 'EmptyPool' | 'OutputTooSmall'

export type Result =
  | { tag: 'Left'; error: SwapError }
  | { tag: 'Right'; amountOut: number; pool: Pool }

export const opposite = (d: Direction): Direction => (d === 'GoldForSilver' ? 'SilverForGold' : 'GoldForSilver')

// The reserves a swap pays into and out of.
export function reserves(direction: Direction, { gold, silver }: Pool) {
  return direction === 'GoldForSilver'
    ? { reserveIn: gold, reserveOut: silver }
    : { reserveIn: silver, reserveOut: gold }
}

// Haskell's div rounds towards minus infinity.
export const div = (a: number, b: number) => Math.floor(a / b)

export function swap({ direction, amountIn, minAmountOut }: Swap, { gold, silver }: Pool): Result {
  if (amountIn <= 0) return { tag: 'Left', error: 'AmountNotPositive' }
  if (gold <= 0 || silver <= 0) return { tag: 'Left', error: 'EmptyPool' }
  const { reserveIn, reserveOut } = reserves(direction, { gold, silver })
  const amountOut = div(reserveOut * amountIn, reserveIn + amountIn)
  if (amountOut === 0 || amountOut < minAmountOut) return { tag: 'Left', error: 'OutputTooSmall' }
  if (direction === 'GoldForSilver') {
    return { tag: 'Right', amountOut, pool: { gold: gold + amountIn, silver: silver - amountOut } }
  }
  return { tag: 'Right', amountOut, pool: { gold: gold - amountOut, silver: silver + amountIn } }
}

// The output before rounding.
export function exactOut(direction: Direction, amountIn: number, pool: Pool): number {
  const { reserveIn, reserveOut } = reserves(direction, pool)
  return (reserveOut * amountIn) / (reserveIn + amountIn)
}

// What the pool holds, counted in silver, when one gold is worth price silver.
export const poolValue = (price: number, p: Pool) => price * p.gold + p.silver

// Values written as Haskell, so they can stand in the code.
export const showInt = (n: number) => (n < 0 ? `(${n})` : `${n}`)
export const showPool = (p: Pool) => `Pool ${showInt(p.gold)} ${showInt(p.silver)}`
export const showSwap = (s: Swap) => `Swap ${s.direction} ${showInt(s.amountIn)} ${showInt(s.minAmountOut)}`
export const showResult = (r: Result) =>
  r.tag === 'Left' ? `Left ${r.error}` : `Right (${r.amountOut}, ${showPool(r.pool)})`

// A number for a sentence: whole numbers as they are, others to two places.
export const num = (n: number) => (Number.isInteger(n) ? `${n}` : n.toFixed(2))

// An output before rounding, cut to two places rather than rounded, so 0.9999 shows as 0.99
// and never looks like the whole number it rounds down from.
// The small nudge keeps a value like 0.29, stored as 0.28999…, from cutting to 0.28.
export const cut = (n: number) => (Number.isInteger(n) ? `${n}` : (Math.floor(n * 100 + 1e-9) / 100).toFixed(2))
