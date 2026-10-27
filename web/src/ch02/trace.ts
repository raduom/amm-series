import type { Line } from './lines'
import { type Pool, type Result, type Swap, cut, exactOut, reserves, showInt, showPool, swap } from './model'

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
  const { direction, amountIn, minAmountOut } = s
  const { gold, silver } = p
  const paysGold = direction === 'GoldForSilver'
  const paid = paysGold ? 'gold' : 'silver'
  const got = paysGold ? 'silver' : 'gold'
  const { reserveIn, reserveOut } = reserves(direction, p)
  const result = swap(s, p)
  const values: Record<string, string> = {
    direction,
    amountIn: showInt(amountIn),
    minAmountOut: showInt(minAmountOut),
    gold: showInt(gold),
    silver: showInt(silver),
    reserveIn: showInt(reserveIn),
    reserveOut: showInt(reserveOut),
  }
  const steps: Step[] = []
  const done = (...more: Step[]): Trace => ({ values, steps: [...steps, ...more], result })

  steps.push({
    line: 'signature',
    uses: [],
    note: 'the call names its inputs',
    say: `The call matches this line, so direction is ${direction}, amountIn is ${amountIn}, minAmountOut is `
      + `${minAmountOut}, gold is ${gold} and silver is ${silver}.`,
  })

  const notPositive = { line: 'notPositive', uses: [], calc: `${showInt(amountIn)} <= 0` } as const
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

  const empty = { line: 'empty', uses: [], calc: `${showInt(gold)} <= 0 || ${showInt(silver)} <= 0` } as const
  if (gold <= 0 || silver <= 0) {
    return done({
      ...empty,
      note: 'True: refused',
      say: `Is a side of the pool empty? It holds ${gold} gold and ${silver} silver. With a side empty there is `
        + `no price to trade at, so swap returns Left EmptyPool.`,
    })
  }
  steps.push({
    ...empty,
    note: 'False: both sides hold something',
    say: `Is a side of the pool empty? It holds ${gold} gold and ${silver} silver, so no, and the next guard is tried.`,
  })

  // The next guard needs amountOut, so Haskell works it out from the where clause.
  const exact = exactOut(direction, amountIn, p)
  const amountOut = Math.floor(exact)
  values.amountOut = showInt(amountOut)
  steps.push({
    line: 'amountOut',
    uses: ['reserveIn', 'reserveOut'],
    note: Number.isInteger(exact) ? `${amountOut}` : `${amountOut}, from ${cut(exact)}… rounded down`,
    calc: `${reserveOut} * ${amountIn} \`div\` (${reserveIn} + ${amountIn})`,
    say: `The next guard needs amountOut, so Haskell works it out from the where clause below. You pay ${paid}, `
      + `so reserveIn is the ${paid} (${reserveIn}) and reserveOut the ${got} (${reserveOut}). `
      + `${reserveOut} × ${amountIn} / ${reserveIn + amountIn} is ${Number.isInteger(exact) ? exact : `${cut(exact)}…`}`
      + (Number.isInteger(exact) ? '.' : `, and div rounds it down to ${amountOut}: the pool keeps the fraction.`),
  })

  const tooSmall = {
    line: 'tooSmall', more: ['tooSmall1'], uses: ['amountOut'],
    calc: `${amountOut} == 0 || ${amountOut} < ${showInt(minAmountOut)}`,
  } as const
  if (amountOut === 0 || amountOut < minAmountOut) {
    return done({
      ...tooSmall,
      note: 'True: refused',
      say: amountOut === 0
        ? `The swap would pay out nothing: ${amountIn} ${paid} is worth less than a whole unit of ${got}. `
          + `swap returns Left OutputTooSmall, so you don't pay for nothing.`
        : `You asked for at least ${minAmountOut} ${got}, and the swap would pay only ${amountOut}. swap returns `
          + `Left OutputTooSmall, and you keep your ${paid}.`,
    })
  }
  steps.push({
    ...tooSmall,
    note: 'False: enough comes out',
    say: minAmountOut <= 0
      ? `${amountOut} is more than 0, and you asked for no minimum, so the next guard is tried.`
      : `${amountOut} is more than 0 and at least the ${minAmountOut} you asked for, so the next guard is tried.`,
  })

  const after = result.tag === 'Right' ? result.pool : p
  const k = gold * silver
  const k1 = after.gold * after.silver
  const payment = {
    note: showPool(after),
    say: `You pay ${amountIn} ${paid} and get ${amountOut} ${got}. The pool ends with ${after.gold} gold and `
      + `${after.silver} silver. gold × silver was ${k} and is now ${k1}`
      + (k1 > k ? ': a little more, from the rounding.' : ', the same.'),
  }
  if (paysGold) {
    return done(
      {
        line: 'goldGuard', uses: [], note: 'True: you pay gold',
        say: 'direction is GoldForSilver: you pay gold and get silver. This guard holds, '
          + 'so the line under it is the answer.',
      },
      { line: 'payGold', more: ['payGold1'], uses: [], ...payment },
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
    { line: 'paySilver', more: ['paySilver1'], uses: [], ...payment },
  )
}
