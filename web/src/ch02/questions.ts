import { type Pool, type Swap, exactOut, showPool, showResult, swap } from './model'

export interface Question {
  swap: Swap
  pool: Pool
}

// Each kind of answer comes up: either direction, every error, rounding, and a minimum.
export const questions: Question[] = [
  { swap: { direction: 'GoldForSilver', amountIn: 10, minAmountOut: 0 }, pool: { gold: 100, silver: 100 } },
  { swap: { direction: 'SilverForGold', amountIn: 50, minAmountOut: 0 }, pool: { gold: 100, silver: 100 } },
  { swap: { direction: 'GoldForSilver', amountIn: 20, minAmountOut: 18 }, pool: { gold: 100, silver: 100 } },
  { swap: { direction: 'GoldForSilver', amountIn: 100, minAmountOut: 40 }, pool: { gold: 100, silver: 100 } },
  { swap: { direction: 'GoldForSilver', amountIn: 1, minAmountOut: 0 }, pool: { gold: 100, silver: 50 } },
  { swap: { direction: 'SilverForGold', amountIn: 30, minAmountOut: 0 }, pool: { gold: 0, silver: 100 } },
  { swap: { direction: 'SilverForGold', amountIn: 10, minAmountOut: 0 }, pool: { gold: 40, silver: 90 } },
  { swap: { direction: 'GoldForSilver', amountIn: 0, minAmountOut: 0 }, pool: { gold: 80, silver: 80 } },
]

// Four answers: the right one, the constant-sum answer, the answer rounded up, what the formula
// gives when a guard should have stopped it, and errors.
export function choices(q: Question, seed: number): string[] {
  const { direction, amountIn: n } = q.swap
  const { gold, silver } = q.pool
  const paysGold = direction === 'GoldForSilver'
  const after = (out: number) =>
    `Right (${out}, ${showPool(paysGold ? { gold: gold + n, silver: silver - out } : { gold: gold - out, silver: silver + n })})`
  const wrong: string[] = []
  if (n > 0 && gold > 0 && silver > 0) {
    wrong.push(after(n), after(Math.ceil(exactOut(direction, n, q.pool))))
  } else {
    // Skipping the guard: the formula still gives an answer, which is a tempting wrong one.
    const exact = exactOut(direction, n, q.pool)
    if (Number.isFinite(exact)) wrong.push(after(Math.max(0, Math.floor(exact))))
  }
  const all = new Set([
    showResult(swap(q.swap, q.pool)),
    ...wrong,
    'Left OutputTooSmall',
    'Left EmptyPool',
    'Left AmountNotPositive',
  ])
  return shuffle([...all].slice(0, 4), seed)
}

// The same order every time for the same seed.
function shuffle<T>(items: T[], seed: number): T[] {
  let s = seed * 7919 + 17
  const next = () => (s = (s * 48271) % 2147483647) / 2147483647
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
