// Lines of model/src/AMM/ConstantProduct.hs the page points at, found by how they start.
// The build fails if one is missing or matches more than one line.
export const lines = {
  start: '-- | How much of each token',
  signature: 'swap (Swap direction amountIn minAmountOut)',
  notPositive: '| amountIn <= 0',
  empty: '| gold <= 0 || silver <= 0',
  tooSmall: '| amountOut == 0',
  tooSmall1: '|| amountOut < minAmountOut',
  goldGuard: '| direction == GoldForSilver',
  payGold: 'Right (amountOut, Pool (gold + amountIn)',
  payGold1: '(silver - amountOut))',
  otherwise: '| otherwise',
  paySilver: 'Right (amountOut, Pool (gold - amountOut)',
  paySilver1: '(silver + amountIn))',
  amountOut: 'amountOut = reserveOut',
  reserveIn: 'reserveIn  = if direction',
  reserveOut: 'reserveOut = if direction',
} as const

export type Line = keyof typeof lines
