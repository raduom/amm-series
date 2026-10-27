import { type Pool, type Swap, showPool, showResult, swap } from './model'

export interface Question {
  swap: Swap
  pool: Pool
}

// Each kind of answer comes up: either direction, both errors, and a pool paid down to zero.
export const questions: Question[] = [
  { swap: { direction: 'GoldForSilver', amountIn: 10 }, pool: { gold: 100, silver: 100 } },
  { swap: { direction: 'SilverForGold', amountIn: 25 }, pool: { gold: 60, silver: 140 } },
  { swap: { direction: 'GoldForSilver', amountIn: 30 }, pool: { gold: 120, silver: 45 } },
  { swap: { direction: 'GoldForSilver', amountIn: 50 }, pool: { gold: 80, silver: 40 } },
  { swap: { direction: 'SilverForGold', amountIn: -5 }, pool: { gold: 70, silver: 70 } },
  { swap: { direction: 'SilverForGold', amountIn: 90 }, pool: { gold: 90, silver: 10 } },
  { swap: { direction: 'GoldForSilver', amountIn: 45 }, pool: { gold: 10, silver: 45 } },
  { swap: { direction: 'SilverForGold', amountIn: 60 }, pool: { gold: 50, silver: 200 } },
]

// Four answers: the right one, the result of paying the other token, and the errors.
export function choices(q: Question, seed: number): string[] {
  const n = q.swap.amountIn
  const { gold, silver } = q.pool
  const all = new Set([
    showResult(swap(q.swap, q.pool)),
    `Right (${n}, ${showPool({ gold: gold + n, silver: silver - n })})`,
    `Right (${n}, ${showPool({ gold: gold - n, silver: silver + n })})`,
    'Left InsufficientLiquidity',
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
