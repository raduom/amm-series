import { mulberry32 } from '../ch02/random'

// The seven Foundry checks, re-implemented here. This models reserve arithmetic,
// not token transfers, approvals, events, or EVM execution.
export type PoolKind = 'honest' | 'thousandth'
export interface Pool { gold: bigint; silver: bigint }
export interface Case {
  pool: Pool
  zeroForOne: boolean
  amountIn: bigint
  extra: bigint
  minimum: bigint
  highMinimum: bigint
}

export const properties = {
  product: 'Product never decreases',
  below: 'Output below reserve',
  minimum: 'Output at least minimum',
  larger: 'Larger trades, worse prices',
  round: 'Round trip never profits',
  positive: 'Reserves stay positive',
  largest: 'Output is the largest that keeps the product',
} as const
export type Property = keyof typeof properties
export const propertyKeys = Object.keys(properties) as Property[]

type SwapResult =
  | { tag: 'paid'; amountOut: bigint; pool: Pool }
  | { tag: 'refused'; error: 'AmountNotPositive' | 'EmptyPool' | 'OutputTooSmall' }

export function reserves(pool: Pool, zeroForOne: boolean) {
  return zeroForOne
    ? { reserveIn: pool.gold, reserveOut: pool.silver }
    : { reserveIn: pool.silver, reserveOut: pool.gold }
}

export function swap(pool: Pool, zeroForOne: boolean, amountIn: bigint, minimum: bigint, kind: PoolKind): SwapResult {
  if (amountIn <= 0n) return { tag: 'refused', error: 'AmountNotPositive' }
  if (pool.gold <= 0n || pool.silver <= 0n) return { tag: 'refused', error: 'EmptyPool' }
  const { reserveIn, reserveOut } = reserves(pool, zeroForOne)
  let amountOut = reserveOut * amountIn / (reserveIn + amountIn)
  if (kind === 'thousandth') amountOut -= amountOut / 1000n
  if (amountOut === 0n || amountOut < minimum) return { tag: 'refused', error: 'OutputTooSmall' }
  return {
    tag: 'paid', amountOut,
    pool: zeroForOne
      ? { gold: reserveIn + amountIn, silver: reserveOut - amountOut }
      : { gold: reserveOut - amountOut, silver: reserveIn + amountIn },
  }
}

export function payoutChecks(reserveIn: bigint, reserveOut: bigint, amountIn: bigint, amountOut: bigint) {
  const before = reserveIn * reserveOut
  const after = (reserveIn + amountIn) * (reserveOut - amountOut)
  const oneMore = (reserveIn + amountIn) * (reserveOut - amountOut - 1n)
  return { before, after, oneMore, keepsProduct: after >= before, isLargest: oneMore < before }
}

export interface Fact { label: string; value: bigint | string }
export interface CheckedCase {
  status: 'passed' | 'failed' | 'discarded'
  reason: string
  facts: Fact[]
}

const uint256Max = (1n << 256n) - 1n
const refused = (r: SwapResult) => r.tag === 'refused' && r.error === 'OutputTooSmall'

export function checkProperty(property: Property, c: Case, kind: PoolKind): CheckedCase {
  const { pool, zeroForOne, amountIn } = c
  const { reserveIn, reserveOut } = reserves(pool, zeroForOne)
  const r = swap(pool, zeroForOne, amountIn, 0n, kind)
  const facts: Fact[] = [
    { label: 'Gold before', value: pool.gold },
    { label: 'Silver before', value: pool.silver },
    { label: 'Direction', value: zeroForOne ? 'Gold → silver' : 'Silver → gold' },
    { label: 'Amount in', value: amountIn },
    { label: 'Payout', value: r.tag === 'paid' ? r.amountOut : r.error },
  ]
  const done = (passed: boolean, reason: string): CheckedCase => ({ status: passed ? 'passed' : 'failed', reason, facts })
  const discard = (): CheckedCase => ({ status: 'discarded', reason: 'Zero-output swap correctly refused; draw another case.', facts })

  // tradeOrDiscard checks the refusal before dropping a zero-output case.
  if (reserveOut * amountIn < reserveIn + amountIn) {
    return refused(r) ? discard() : done(false, 'A zero-output swap was not refused with OutputTooSmall.')
  }
  if (r.tag === 'refused') return done(false, 'A swap that should pay was refused.')
  const out = r.amountOut

  if (property === 'product') {
    const before = pool.gold * pool.silver
    const after = r.pool.gold * r.pool.silver
    facts.push({ label: 'Product before', value: before }, { label: 'Product after', value: after })
    return done(after >= before, 'The product after must be at least the product before.')
  }
  if (property === 'below') return done(out < reserveOut, 'The payout must be below the reserve it came from.')

  if (property === 'minimum') {
    // Each call starts from the original pool, like snapshotState/revertToState.
    // The minima are based on the actual payout, as in the Foundry test.
    const minimum = c.minimum % (out + 1n)
    const highMinimum = out + 1n + c.highMinimum % (uint256Max - out)
    const low = swap(pool, zeroForOne, amountIn, minimum, kind)
    const oneAbove = swap(pool, zeroForOne, amountIn, out + 1n, kind)
    const high = swap(pool, zeroForOne, amountIn, highMinimum, kind)
    facts.push({ label: 'Accepted minimum', value: minimum },
      { label: 'One above payout', value: out + 1n }, { label: 'Higher minimum', value: highMinimum })
    return done(low.tag === 'paid' && low.amountOut === out && refused(oneAbove) && refused(high),
      'A minimum up to the payout must leave it unchanged; one above and any higher minimum must be refused.')
  }

  if (property === 'larger') {
    const largerIn = amountIn + c.extra
    const larger = swap(pool, zeroForOne, largerIn, 0n, kind)
    facts.push({ label: 'Larger amount in', value: largerIn },
      { label: 'Larger payout', value: larger.tag === 'paid' ? larger.amountOut : larger.error })
    if (larger.tag === 'refused') return done(false, 'The larger swap from the same starting pool was refused.')
    const lhs = larger.amountOut * amountIn
    const rhs = (out + 1n) * largerIn
    facts.push({ label: 'largerOut × amountIn', value: lhs }, { label: '(amountOut + 1) × largerIn', value: rhs })
    return done(larger.amountOut >= out && lhs < rhs,
      larger.amountOut < out ? 'Paying more got less out.' : 'The larger payout × smaller input must be below (smaller payout + 1) × larger input.')
  }

  if (property === 'round') {
    const back = swap(r.pool, !zeroForOne, out, 0n, kind)
    const reverse = reserves(r.pool, !zeroForOne)
    facts.push({ label: 'Payout on return', value: back.tag === 'paid' ? back.amountOut : back.error })
    if (reverse.reserveOut * out < reverse.reserveIn + out) {
      return refused(back) ? discard() : done(false, 'The zero-output return swap was not correctly refused.')
    }
    return done(back.tag === 'paid' && back.amountOut <= amountIn,
      'Swapping the payout back on the changed pool must return no more than the original input.')
  }

  if (property === 'positive') {
    facts.push({ label: 'Gold after', value: r.pool.gold }, { label: 'Silver after', value: r.pool.silver })
    return done(r.pool.gold > 0n && r.pool.silver > 0n, 'Both reserves must stay above zero.')
  }

  const k = payoutChecks(reserveIn, reserveOut, amountIn, out)
  facts.push({ label: 'Product before', value: k.before }, { label: 'Product after', value: k.after },
    { label: 'Product with one more paid', value: k.oneMore })
  return done(k.keepsProduct && k.isLargest, !k.keepsProduct
    ? 'Paid too much: the product fell.'
    : !k.isLargest ? 'Paid too little: one more unit would still keep the product.'
      : 'The payout keeps the product; one more unit would lower it.')
}

// Rejection sampling keeps every integer exact, even for uint256-sized minima.
function integer(random: () => number, low: bigint, high: bigint): bigint {
  const range = high - low
  const bits = range.toString(2).length
  const mask = (1n << BigInt(bits)) - 1n
  for (;;) {
    let n = 0n
    for (let i = 0; i < bits; i += 32) n = (n << 32n) | BigInt(Math.floor(random() * 4294967296))
    n &= mask
    if (n <= range) return low + n
  }
}

export function randomCase(random: () => number): Case {
  // A smaller range than Foundry's, for readable examples. Products can still
  // exceed Number.MAX_SAFE_INTEGER; payouts are usually 1,000 or more, so a thousandth is at least a unit.
  const amount = () => integer(random, 10_000n, 1_000_000_000n)
  return {
    pool: { gold: amount(), silver: amount() }, zeroForOne: random() < 0.5,
    amountIn: amount(), extra: integer(random, 1n, 1_000_000_000n),
    minimum: integer(random, 0n, uint256Max), highMinimum: integer(random, 0n, uint256Max),
  }
}

export interface Run {
  property: Property
  status: 'passed' | 'failed' | 'incomplete'
  passed: number
  discarded: number
  failure?: CheckedCase
}

export function runProperties(seed: number, kind: PoolKind, count = 200): Run[] {
  return propertyKeys.map((property, i) => {
    // Separate streams: a failure in one property cannot shift another's cases.
    // Both pool modes receive the same cases when the seed is unchanged.
    const random = mulberry32((seed + Math.imul(i + 1, 0x9e3779b9)) >>> 0)
    const run: Run = { property, status: 'incomplete', passed: 0, discarded: 0 }
    for (let attempt = 0; attempt < count * 100 && run.passed < count; attempt++) {
      const checked = checkProperty(property, randomCase(random), kind)
      if (checked.status === 'discarded') run.discarded++
      else if (checked.status === 'passed') run.passed++
      else return { ...run, status: 'failed', failure: checked }
    }
    if (run.passed === count) run.status = 'passed'
    return run
  })
}
