// Lines of model/src/AMM/ConstantSum.hs the page points at, found by how they start.
// The build fails if one is missing or matches more than one line.
export const lines = {
  start: '-- | How much of each token',
  signature: 'swap (Swap zeroForOne amountIn)',
  notPositive: '| amountIn <= 0',
  insufficient: '| amountOut > reserveOut',
  zeroForOne: '| zeroForOne',
  payA: 'Right (amountOut, Pool (reserve0 + amountIn)',
  payA1: '(reserve1 - amountOut))',
  otherwise: '| otherwise',
  payB: 'Right (amountOut, Pool (reserve0 - amountOut)',
  payB1: '(reserve1 + amountIn))',
  amountOut: 'amountOut  = amountIn',
  reserveOut: 'reserveOut = if zeroForOne',
} as const

export type Line = keyof typeof lines
