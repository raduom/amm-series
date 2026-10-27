import { type Pool, type Swap, opposite, showInt, showPool, showResult, showSwap, swap } from './model'
import type { Property } from './propertyLines'

// The inputs generated for one case.
export interface Case {
  pool: Pool
  swap: Swap
}

// Made-up cases, loosely like QuickCheck's: reserves that aren't negative, amounts of
// either sign, and numbers that grow as the run goes on. The same seed gives the same cases.
export function cases(seed: number, count: number): Case[] {
  const random = mulberry32(seed)
  const upTo = (n: number) => Math.floor(random() * (n + 1))
  return Array.from({ length: count }, (_, i) => {
    const size = 10 + i
    return {
      pool: { gold: upTo(size), silver: upTo(size) },
      swap: { direction: random() < 0.5 ? 'GoldForSilver' : 'SilverForGold', amountIn: upTo(2 * size) - size },
    }
  })
}

function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// One step of reading a property on a case.
export interface Step {
  line: 'def' | 'call' | 'check'
  note: string   // a short comment at the end of the line
  named?: string // the note when the code shows names, if it differs
  say: string    // a sentence under the code
}

export interface Trace {
  values: Record<string, string> // what each name in the property stands for, written as Haskell
  steps: Step[]
  checked: boolean // the swap succeeded, so the property had something to check
  passed: boolean
}

const verdict = (ok: boolean) => (ok ? 'passes' : 'fails')

export function trace(property: Property, c: Case): Trace {
  const { pool, swap: s } = c
  const result = swap(s, pool)
  const values: Record<string, string> = { pool: `(${showPool(pool)})`, s: `(${showSwap(s)})` }
  const steps: Step[] = [{
    line: 'def',
    note: 'generated at random',
    named: `pool = ${showPool(pool)}, s = ${showSwap(s)}`,
    say: `A property is a test that leaves its inputs as names. The widget generates them at random: a pool `
      + `whose reserves aren't negative, and a swap of any amount, even zero or a negative one. `
      + `This time pool is ${showPool(pool)} and s is ${showSwap(s)}.`,
  }]

  if (result.tag === 'Left') {
    steps.push({
      line: 'call',
      note: `${showResult(result)}: nothing to check`,
      say: `whenSwapSucceeds runs swap s pool first. This swap is refused with ${result.error}, `
        + `so there is nothing to check, and the case passes as it is.`,
    })
    return { values, steps, checked: false, passed: true }
  }

  const { amountOut, pool: after } = result
  const out = showInt(amountOut)
  values.amountOut = out
  values["pool'"] = `(${showPool(after)})`
  // How the property's lambda takes the amount and the new pool.
  const ignoresAmount = { note: `_ is ${out}, pool' is ${showPool(after)}`,
    how: "ignores the amount by writing _, and calls the new pool pool'" }
  const takes = {
    sum: ignoresAmount,
    output: { note: `amountOut is ${out}`, how: 'calls the amount amountOut, and ignores the new pool by writing _' },
    back: { note: `amountOut is ${out}, pool' is ${showPool(after)}`, how: "calls them amountOut and pool'" },
    nonNegative: ignoresAmount,
  }[property]
  steps.push({
    line: 'call',
    note: takes.note,
    say: `whenSwapSucceeds runs swap s pool first. It succeeds with ${showResult(result)}, and the `
      + `amount and the new pool go to the function after $. That function, written \\… -> …, `
      + `${takes.how}.`,
  })

  const done = (passed: boolean, ...more: Step[]): Trace =>
    ({ values, steps: [...steps, ...more], checked: true, passed })
  const { gold: a0, silver: a1 } = after
  const { gold: b0, silver: b1 } = pool

  if (property === 'sum') {
    const ok = a0 + a1 === b0 + b1
    return done(ok, {
      line: 'check',
      note: `${a0} + ${a1} === ${b0} + ${b1}`,
      say: `gold pool' reads the field gold of the new pool. The left side adds up the gold and `
        + `silver after the swap, the right side the gold and silver before.`,
    }, {
      line: 'check',
      note: `${a0 + a1} === ${b0 + b1}: ${verdict(ok)}`,
      say: `=== checks that both sides are equal, and shows both when they aren't. `
        + (ok ? `${a0 + a1} is ${b0 + b1}, so this case passes.` : `They differ, so the property fails.`),
    })
  }

  if (property === 'output') {
    const ok = amountOut === s.amountIn
    return done(ok, {
      line: 'check',
      note: `${out} === ${showInt(s.amountIn)}: ${verdict(ok)}`,
      say: `amountIn s reads the field amountIn of the swap: what you paid. The pool paid out ${out}, `
        + `you paid ${s.amountIn}, and === checks they are equal. `
        + (ok ? 'They are, so this case passes.' : "They aren't, so the property fails."),
    })
  }

  if (property === 'back') {
    const reverse: Swap = { direction: opposite(s.direction), amountIn: amountOut }
    const got = swap(reverse, after)
    const want = `Right (${showInt(s.amountIn)}, ${showPool(pool)})`
    const ok = showResult(got) === want
    return done(ok, {
      line: 'check',
      note: `swap (${showSwap(reverse)}) (${showPool(after)}) === ${want}`,
      say: `The left side swaps back: the other way, opposite (direction s), paying in what came out. `
        + `The right side is what you'd expect back: what you first paid, and the pool you started with.`,
    }, {
      line: 'check',
      note: `${showResult(got)} === ${want}: ${verdict(ok)}`,
      say: `Swapping back gives ${showResult(got)}. `
        + (ok ? 'Both sides are equal, so this case passes.' : "The sides differ, so the property fails."),
    })
  }

  const ok = a0 >= 0 && a1 >= 0
  return done(ok, {
    line: 'check',
    note: `${a0} >= 0 && ${a1} >= 0`,
    say: `This check is a plain Bool: are the gold and the silver of the new pool both at least 0? property turns `
      + `the Bool into a check.`,
  }, {
    line: 'check',
    note: `${ok ? 'True' : 'False'}: ${verdict(ok)}`,
    say: ok ? `${a0} and ${a1} are both at least 0, so this case passes.` : 'Gold or silver went negative, so the property fails.',
  })
}
