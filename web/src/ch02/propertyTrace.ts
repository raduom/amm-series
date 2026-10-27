import { type Pool, type Swap, num, opposite, reserves, showInt, showPool, showResult, showSwap, swap } from './model'
import type { Property } from './propertyLines'
import { mulberry32 } from './random'

// The inputs generated for one case. extra is only used by the larger-trades property.
export interface Case {
  pool: Pool
  swap: Swap
  extra: number
}

// Made-up cases, loosely like QuickCheck's: reserves that aren't negative, amounts of either
// sign, and numbers that grow as the run goes on. The same seed gives the same cases.
export function cases(seed: number, count: number): Case[] {
  const random = mulberry32(seed)
  const upTo = (n: number) => Math.floor(random() * (n + 1))
  return Array.from({ length: count }, (_, i) => {
    const size = 10 + i
    return {
      pool: { gold: upTo(size), silver: upTo(size) },
      swap: {
        direction: random() < 0.5 ? 'GoldForSilver' : 'SilverForGold',
        amountIn: upTo(2 * size) - size,
        minAmountOut: upTo(2 * size) - size,
      },
      extra: 1 + upTo(size),
    }
  })
}

// One step of reading a property on a case.
export interface Step {
  line: string   // a line of the excerpt: def, call, or one of the property's own
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
const bool = (ok: boolean) => (ok ? 'True' : 'False')

export function trace(property: Property, c: Case): Trace {
  const { pool, swap: s, extra } = c
  const result = swap(s, pool)
  const values: Record<string, string> = { pool: `(${showPool(pool)})`, s: `(${showSwap(s)})` }
  const larger = property === 'larger'
  if (larger) values.extra = showInt(extra)
  const steps: Step[] = [{
    line: 'def',
    note: 'generated at random',
    named: `pool = ${showPool(pool)}, s = ${showSwap(s)}` + (larger ? `, extra = ${extra}` : ''),
    say: `The widget generates the inputs at random: a pool whose reserves aren't negative, and a swap of any `
      + `amount and any minimum, even zero or negative ones`
      + (larger ? `, and a positive extra amount for a second, larger swap` : '')
      + `. This time pool is ${showPool(pool)} and s is ${showSwap(s)}`
      + (larger ? `, and extra is ${extra}.` : '.'),
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
  const takes = {
    product: { note: `pool' is ${showPool(after)}`, how: "ignores the amount by writing _, and calls the new pool pool'" },
    below: { note: `amountOut is ${out}`, how: 'calls the amount amountOut, and ignores the new pool by writing _' },
    minimum: { note: `amountOut is ${out}`, how: 'calls the amount amountOut, and ignores the new pool by writing _' },
    larger: { note: `amountOut is ${out}`, how: 'calls the amount amountOut, and ignores the new pool by writing _' },
    round: { note: `amountOut is ${out}, pool' is ${showPool(after)}`, how: "calls them amountOut and pool'" },
    positive: { note: `pool' is ${showPool(after)}`, how: "ignores the amount by writing _, and calls the new pool pool'" },
  }[property]
  steps.push({
    line: 'call',
    note: takes.note,
    say: `whenSwapSucceeds runs swap s pool first. It succeeds with ${showResult(result)}, and the amount and the `
      + `new pool go to the function after $. That function, written \\… -> …, ${takes.how}.`,
  })

  const done = (passed: boolean, ...more: Step[]): Trace =>
    ({ values, steps: [...steps, ...more], checked: true, passed })

  if (property === 'product') {
    const k0 = pool.gold * pool.silver
    const k1 = after.gold * after.silver
    const ok = k1 >= k0
    return done(ok, {
      line: 'check',
      note: `${after.gold} * ${after.silver} >= ${pool.gold} * ${pool.silver}`,
      say: `The left side is k after the swap, gold times silver of the new pool; the right side is k before.`,
    }, {
      line: 'check',
      note: `${k1} >= ${k0}: ${verdict(ok)}`,
      say: k1 === k0 ? `k is ${k0} before and after: the swap paid out exactly, with nothing to round. This case passes.`
        : ok ? `k grew from ${k0} to ${k1}: rounding down left a little more in the pool. This case passes.`
        : 'k fell, so the property fails.',
    })
  }

  if (property === 'below') {
    const { reserveOut } = reserves(s.direction, pool)
    const ok = amountOut < reserveOut
    return done(ok, {
      line: 'check',
      note: `${out} < ${reserveOut}: ${verdict(ok)}`,
      say: `reserveOut s pool, the helper above, is the side the swap pays from: ${reserveOut}. `
        + (ok ? `The swap paid ${amountOut}, less than all of it, so this case passes.`
          : 'The swap paid all of it, so the property fails.'),
    })
  }

  if (property === 'minimum') {
    const ok = amountOut >= s.minAmountOut
    return done(ok, {
      line: 'check',
      note: `${out} >= ${showInt(s.minAmountOut)}: ${verdict(ok)}`,
      say: `minAmountOut s reads the minimum the trader asked for: ${s.minAmountOut}. `
        + (ok ? `The swap paid ${amountOut}, at least that, so this case passes.` : 'It paid less, so the property fails.'),
    })
  }

  if (property === 'larger') {
    const bigger: Swap = { ...s, amountIn: s.amountIn + extra }
    values.larger = `(${showSwap(bigger)})`
    const r2 = swap(bigger, pool)
    const intro: Step = {
      line: 'larger',
      note: showSwap(bigger),
      say: `larger, defined in the where clause, is the same swap paying extra more: ${s.amountIn} + ${extra} = `
        + `${bigger.amountIn}.`,
    }
    if (r2.tag === 'Left') {
      return done(false, intro, {
        line: 'refused',
        note: `${showResult(r2)}: fails`,
        say: `The larger swap was refused with ${r2.error}, which the property counts as a failure.`,
      })
    }
    const out2 = r2.amountOut
    values["amountOut'"] = showInt(out2)
    const more = out2 >= amountOut
    const lhs = out2 * s.amountIn
    const rhs = (amountOut + 1) * bigger.amountIn
    const price = lhs < rhs
    const ok = more && price
    return done(ok, intro, {
      line: 'got',
      note: `amountOut' is ${out2}`,
      say: `Run on the same pool, the larger swap succeeds with ${out2}, which the case names amountOut'.`,
    }, {
      line: 'more',
      note: `${out2} >= ${amountOut}: ${bool(more)}`,
      say: `First: paying more never gets less out. ${out2} against ${amountOut}: ${more ? 'it holds' : "it doesn't"}.`,
    }, {
      line: 'price',
      note: `${lhs} < ${rhs}`,
      say: `Then the prices, multiplied out so nothing is divided: is ${out2}/${bigger.amountIn} below `
        + `(${amountOut} + 1)/${s.amountIn}? That is ${num(out2 / bigger.amountIn)} against `
        + `${num((amountOut + 1) / s.amountIn)}.`,
    }, {
      line: 'price',
      note: `${bool(price)}: ${verdict(ok)}`,
      say: `Why + 1: rounding down may have taken up to one unit from the smaller swap, so its price, `
        + `${num(amountOut / s.amountIn)}, can be a little worse than the curve's. The larger swap may beat it, `
        + `but by less than one unit of output spread over the smaller swap's ${s.amountIn}. .&&. needs both `
        + `checks to hold, so this case ${verdict(ok)}.`,
    })
  }

  if (property === 'round') {
    const back: Swap = { direction: opposite(s.direction), amountIn: amountOut, minAmountOut: 0 }
    const r2 = swap(back, after)
    const paid = s.direction === 'GoldForSilver' ? 'gold' : 'silver'
    const intro: Step = {
      line: 'case',
      note: `swap (${showSwap(back)}) (${showPool(after)})`,
      say: `Now swap back: the other way, opposite (direction s), paying in the ${amountOut} that came out, `
        + `with no minimum, on the new pool.`,
    }
    if (r2.tag === 'Left') {
      return done(true, intro, {
        line: 'refused',
        note: `${showResult(r2)}: passes`,
        say: `Swapping back is refused with ${r2.error}, so nothing came back and nothing was gained. This case passes.`,
      })
    }
    values.back = showInt(r2.amountOut)
    const ok = r2.amountOut <= s.amountIn
    return done(ok, intro, {
      line: 'back',
      note: `${r2.amountOut} <= ${s.amountIn}: ${verdict(ok)}`,
      say: `Swapping back returns ${r2.amountOut} ${paid}, named back. You paid ${s.amountIn}`
        + (ok ? `, so the round trip didn't profit, and this case passes.` : ', so you profited, and the property fails.'),
    })
  }

  const ok = after.gold > 0 && after.silver > 0
  return done(ok, {
    line: 'check',
    note: `${after.gold} > 0 && ${after.silver} > 0`,
    say: `A plain Bool: do the gold and the silver of the new pool both hold something? property turns the Bool into a check.`,
  }, {
    line: 'check',
    note: `${bool(ok)}: ${verdict(ok)}`,
    say: ok ? `${after.gold} and ${after.silver} are both more than 0, so this case passes.`
      : 'A side of the pool was emptied, so the property fails.',
  })
}
