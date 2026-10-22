// The chapter 1 model in TypeScript, for the page. The Haskell model is the reference.

export interface Pool {
  reserve0: number
  reserve1: number
}

export interface Swap {
  zeroForOne: boolean
  amountIn: number
}

export type SwapError = 'AmountNotPositive' | 'InsufficientLiquidity'

export type Result =
  | { tag: 'Left'; error: SwapError }
  | { tag: 'Right'; amountOut: number; pool: Pool }

export function swap({ zeroForOne, amountIn }: Swap, { reserve0, reserve1 }: Pool): Result {
  const amountOut = amountIn
  const reserveOut = zeroForOne ? reserve1 : reserve0
  if (amountIn <= 0) return { tag: 'Left', error: 'AmountNotPositive' }
  if (amountOut > reserveOut) return { tag: 'Left', error: 'InsufficientLiquidity' }
  if (zeroForOne) {
    return { tag: 'Right', amountOut, pool: { reserve0: reserve0 + amountIn, reserve1: reserve1 - amountOut } }
  }
  return { tag: 'Right', amountOut, pool: { reserve0: reserve0 - amountOut, reserve1: reserve1 + amountIn } }
}

// Values written as Haskell, so they can stand in the code.
export const showInt = (n: number) => (n < 0 ? `(${n})` : `${n}`)
export const showBool = (b: boolean) => (b ? 'True' : 'False')
export const showPool = (p: Pool) => `Pool ${showInt(p.reserve0)} ${showInt(p.reserve1)}`
export const showSwap = (s: Swap) => `Swap ${showBool(s.zeroForOne)} ${showInt(s.amountIn)}`
export const showResult = (r: Result) =>
  r.tag === 'Left' ? `Left ${r.error}` : `Right (${r.amountOut}, ${showPool(r.pool)})`
