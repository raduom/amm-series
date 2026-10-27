import type { Line } from './lines'
import { type Pool, type Result, type Swap, showInt, showPool, swap } from './model'

// One step of reading swap: the line Haskell is on and what it finds there.
export interface Step {
  line: Line
  more?: readonly Line[] // further lines of the same expression
  uses: readonly Line[] // lines this one reads from
  note: string   // a short comment at the end of the line
  calc?: string  // the line's test with values filled in, for when the code shows names
  say: string    // a sentence under the code
}

export interface Trace {
  values: Record<string, string> // what each name in swap stands for, written as Haskell
  steps: Step[]
  result: Result
}

export function trace(s: Swap, p: Pool): Trace {
  const { direction, amountIn } = s
  const { gold, silver } = p
  const paysGold = direction === 'GoldForSilver'
  const amountOut = amountIn
  const reserveOut = paysGold ? silver : gold
  const got = paysGold ? 'silver' : 'gold'
  const result = swap(s, p)
  const values = {
    direction,
    amountIn: showInt(amountIn),
    gold: showInt(gold),
    silver: showInt(silver),
    amountOut: showInt(amountOut),
    reserveOut: showInt(reserveOut),
  }
  const done = (...more: Step[]): Trace => ({ values, steps: [...steps, ...more], result })

  const steps: Step[] = [{
    line: 'signature',
    uses: [],
    note: 'the call names its inputs',
    say: `The call matches this line, so direction is ${direction}, amountIn is ${amountIn}, `
      + `gold is ${gold} and silver is ${silver}.`,
  }]

  const notPositive = { line: 'notPositive', uses: [], calc: `${amountIn} <= 0` } as const
  if (amountIn <= 0) {
    return done({
      ...notPositive,
      note: 'True: refused',
      say: `Guards are tried from the top. amountIn is ${amountIn}, which is not more than 0, so this guard `
        + `is True and swap returns Left AmountNotPositive. The pool doesn't change.`,
    })
  }
  steps.push({
    ...notPositive,
    note: 'False: the amount is positive',
    say: `Guards are tried from the top. amountIn is ${amountIn}, more than 0, so this guard is False `
      + `and the next guard is tried.`,
  })

  const insufficient = {
    line: 'insufficient', uses: ['amountOut', 'reserveOut'], calc: `${amountOut} > ${reserveOut}`,
  } as const
  if (amountOut > reserveOut) {
    return done({
      ...insufficient,
      note: "True: the pool can't pay",
      say: `Can the pool pay? You would get ${amountOut} ${got}, but the pool holds only ${reserveOut}. `
        + `This guard is True, so swap returns Left InsufficientLiquidity.`,
    })
  }
  steps.push({
    ...insufficient,
    note: 'False: the pool can pay',
    say: `Can the pool pay? amountOut is ${amountOut}, the same as you pay, and reserveOut is the side you `
      + `get: ${reserveOut} ${got}. ${amountOut} > ${reserveOut} is False, so the next guard is tried.`,
  })

  const after = result.tag === 'Right' ? result.pool : p
  const sum = gold + silver
  const paid = {
    note: showPool(after),
    say: `You pay ${amountIn} ${paysGold ? 'gold' : 'silver'} and get ${amountOut} ${got} back. The pool ends `
      + `with ${after.gold} gold and ${after.silver} silver, and the sum is still ${sum}.`,
  }
  if (paysGold) {
    return done(
      {
        line: 'goldGuard', uses: [], note: 'True: you pay gold',
        say: 'direction is GoldForSilver: you pay gold and get silver. This guard holds, '
          + 'so the line under it is the answer.',
      },
      { line: 'payGold', more: ['payGold1'], uses: [], ...paid },
    )
  }
  return done(
    {
      line: 'goldGuard', uses: [], note: 'False: you pay silver',
      say: 'direction is SilverForGold, not GoldForSilver, so you pay silver and get gold. The next guard is tried.',
    },
    {
      line: 'otherwise', uses: [], note: 'always True',
      say: 'otherwise is another name for True. It catches every case left, so the line under it is the answer.',
    },
    { line: 'paySilver', more: ['paySilver1'], uses: [], ...paid },
  )
}
