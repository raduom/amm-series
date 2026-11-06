// The pool's payout and the hidden-fee mutant's, in exact integers like the contract.
// This models the swap's arithmetic only, not token transfers or EVM execution.
export interface Pool { reserveIn: bigint; reserveOut: bigint }

// amountOut = reserveOut * amountIn / (reserveIn + amountIn)
export function honest({ reserveIn, reserveOut }: Pool, amountIn: bigint) {
  return { num: reserveOut * amountIn, den: reserveIn + amountIn }
}

// amountOut = reserveOut * amountIn * 999 / (reserveIn * 1000 + amountIn * 999)
export function withFee({ reserveIn, reserveOut }: Pool, amountIn: bigint) {
  return { num: reserveOut * amountIn * 999n, den: reserveIn * 1000n + amountIn * 999n }
}

export interface Owed { num: bigint; den: bigint }
export const pays = ({ num, den }: Owed) => num / den

// The exact amount owed, cut (not rounded) to `places` decimals, and whether digits were cut.
export function decimal({ num, den }: Owed, places = 2) {
  const scale = 10n ** BigInt(places)
  const scaled = num * scale / den
  const whole = scaled / scale
  const frac = (scaled % scale).toString().padStart(places, '0')
  return { whole, frac, cut: num * scale % den !== 0n }
}

export function productCheck(pool: Pool, amountIn: bigint, amountOut: bigint) {
  const before = pool.reserveIn * pool.reserveOut
  const after = (pool.reserveIn + amountIn) * (pool.reserveOut - amountOut)
  const oneMore = (pool.reserveIn + amountIn) * (pool.reserveOut - amountOut - 1n)
  return { before, after, oneMore, keepsProduct: after >= before, isLargest: oneMore < before }
}
