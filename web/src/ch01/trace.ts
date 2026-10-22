import type { Line } from './lines'
import { type Pool, type Result, type Swap, showBool, showInt, showPool, swap } from './model'

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
  const { zeroForOne, amountIn } = s
  const { reserve0, reserve1 } = p
  const amountOut = amountIn
  const reserveOut = zeroForOne ? reserve1 : reserve0
  const got = zeroForOne ? 'B' : 'A'
  const result = swap(s, p)
  const values = {
    zeroForOne: showBool(zeroForOne),
    amountIn: showInt(amountIn),
    reserve0: showInt(reserve0),
    reserve1: showInt(reserve1),
    amountOut: showInt(amountOut),
    reserveOut: showInt(reserveOut),
  }
  const done = (...more: Step[]): Trace => ({ values, steps: [...steps, ...more], result })

  const steps: Step[] = [{
    line: 'signature',
    uses: [],
    note: 'the call names its inputs',
    say: `The call matches this line, so zeroForOne is ${values.zeroForOne}, amountIn is ${amountIn}, `
      + `reserve0 is ${reserve0} and reserve1 is ${reserve1}.`,
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
      + `and Haskell moves to the next one.`,
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
      + `get: ${reserveOut} ${got}. ${amountOut} > ${reserveOut} is False, so Haskell moves on.`,
  })

  const after = result.tag === 'Right' ? result.pool : p
  const sum = reserve0 + reserve1
  const paid = {
    note: showPool(after),
    say: `You pay ${amountIn} ${zeroForOne ? 'A' : 'B'} and get ${amountOut} ${got} back. The pool ends `
      + `with ${after.reserve0} A and ${after.reserve1} B, and the sum is still ${sum}.`,
  }
  if (zeroForOne) {
    return done(
      {
        line: 'zeroForOne', uses: [], note: 'True: you pay A',
        say: 'zeroForOne is True: you pay token0, A, and get token1, B. This guard holds, '
          + 'so the line under it is the answer.',
      },
      { line: 'payA', more: ['payA1'], uses: [], ...paid },
    )
  }
  return done(
    {
      line: 'zeroForOne', uses: [], note: 'False: you pay B',
      say: 'zeroForOne is False, so you pay token1, B, and get token0, A. Haskell moves on.',
    },
    {
      line: 'otherwise', uses: [], note: 'always True',
      say: 'otherwise is another name for True. It catches every case left, so the line under it is the answer.',
    },
    { line: 'payB', more: ['payB1'], uses: [], ...paid },
  )
}
