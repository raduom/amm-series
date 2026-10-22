import { type Pool, type Swap, showPool, showResult, swap } from './model'

export interface Question {
  swap: Swap
  pool: Pool
}

// Each kind of answer comes up: either direction, both errors, and a pool paid down to zero.
export const questions: Question[] = [
  { swap: { zeroForOne: true, amountIn: 10 }, pool: { reserve0: 100, reserve1: 100 } },
  { swap: { zeroForOne: false, amountIn: 25 }, pool: { reserve0: 60, reserve1: 140 } },
  { swap: { zeroForOne: true, amountIn: 30 }, pool: { reserve0: 120, reserve1: 45 } },
  { swap: { zeroForOne: true, amountIn: 50 }, pool: { reserve0: 80, reserve1: 40 } },
  { swap: { zeroForOne: false, amountIn: -5 }, pool: { reserve0: 70, reserve1: 70 } },
  { swap: { zeroForOne: false, amountIn: 90 }, pool: { reserve0: 90, reserve1: 10 } },
  { swap: { zeroForOne: true, amountIn: 45 }, pool: { reserve0: 10, reserve1: 45 } },
  { swap: { zeroForOne: false, amountIn: 60 }, pool: { reserve0: 50, reserve1: 200 } },
]

// Four answers: the right one, the result of paying the other token, and the errors.
export function choices(q: Question, seed: number): string[] {
  const n = q.swap.amountIn
  const { reserve0: r0, reserve1: r1 } = q.pool
  const all = new Set([
    showResult(swap(q.swap, q.pool)),
    `Right (${n}, ${showPool({ reserve0: r0 + n, reserve1: r1 - n })})`,
    `Right (${n}, ${showPool({ reserve0: r0 - n, reserve1: r1 + n })})`,
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
