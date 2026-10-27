// Lines of model/src/AMM/ConstantSum.hs the page points at, found by how they start.
// The build fails if one is missing or matches more than one line.
export const lines = {
  start: '-- | How much of each token',
  signature: 'swap (Swap direction amountIn)',
  notPositive: '| amountIn <= 0',
  insufficient: '| amountOut > reserveOut',
  goldGuard: '| direction == GoldForSilver',
  payGold: 'Right (amountOut, Pool (gold + amountIn)',
  payGold1: '(silver - amountOut))',
  otherwise: '| otherwise',
  paySilver: 'Right (amountOut, Pool (gold - amountOut)',
  paySilver1: '(silver + amountIn))',
  amountOut: 'amountOut  = amountIn',
  reserveOut: 'reserveOut = if direction',
} as const

export type Line = keyof typeof lines
