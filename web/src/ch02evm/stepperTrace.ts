// The pool's swap re-done in TypeScript, step by step, for the page. The contract in
// evm/src/ConstantProductPool.sol is the reference; this follows its lines in their order.

// Lines of the contract the stepper points at, found by how they start.
// The page fails to load if one is missing or matches more than one line.
export const lines = {
  signature: 'function swap(bool zeroForOne',
  notPositive: 'if (amountIn == 0) revert AmountNotPositive();',
  empty: 'if (reserve0 == 0 || reserve1 == 0) revert EmptyPool();',
  pick: '(uint256 reserveIn, uint256 reserveOut) =',
  pick1: 'zeroForOne ? (reserve0, reserve1)',
  keep: '// keep reserveIn * reserveOut',
  amountOut: 'amountOut = reserveOut * amountIn',
  tooSmall: 'if (amountOut == 0 || amountOut < minAmountOut)',
  tooSmall1: 'revert OutputTooSmall();',
  ifGold: 'if (zeroForOne) {',
  gold0: 'reserve0 = reserveIn + amountIn;',
  gold1: 'reserve1 = reserveOut - amountOut;',
  otherwise: '} else {',
  silver0: 'reserve0 = reserveOut - amountOut;',
  silver1: 'reserve1 = reserveIn + amountIn;',
  emit: 'emit Swap(',
  settled: '// the books are settled',
  tokens: '(IERC20 tokenIn, IERC20 tokenOut) =',
  tokens1: 'zeroForOne ? (token0, token1)',
  pull: 'tokenIn.safeTransferFrom(',
  pay: 'tokenOut.safeTransfer(',
} as const

export type Line = keyof typeof lines

// One token's ledger, as far as the trader and the pool go.
export interface Ledger {
  trader: number
  pool: number
  allowance: number // how much the trader lets the pool take
}

export interface Entry {
  zeroForOne: boolean
  amountIn: number
  amountOut: number
}

// Everything the swap reads or writes: the pool's books, both tokens' ledgers, and the log.
export interface State {
  reserve0: number // gold on the pool's books
  reserve1: number // silver on the pool's books
  gold: Ledger
  silver: Ledger
  log: Entry[]
}

export interface Call {
  zeroForOne: boolean // pay gold, token0, for silver
  amountIn: number
  minAmountOut: number
}

export type Phase = 'before' | 'during' | 'reverted' | 'after'

export interface Step {
  lines: readonly Line[]
  notes: Partial<Record<Line, string>>
  values: Record<string, string> // names on the step's lines, written as values
  say: string
  state: State  // what the books, ledgers and log hold once the step has run
  phase: Phase
  pause?: boolean // between the books and the transfers
}

export type Result =
  | { tag: 'ok'; amountOut: number; state: State }
  | { tag: 'revert'; error: string; payment: boolean } // payment: in a transfer, after the books changed

export interface Trace {
  steps: Step[]
  result: Result
}

export const fmt = (n: number) => n.toLocaleString('en-US')

export const copy = (s: State): State => ({ ...s, gold: { ...s.gold }, silver: { ...s.silver }, log: [...s.log] })

export function trace(c: Call, start: State): Trace {
  const { zeroForOne, amountIn, minAmountOut } = c
  const paid = zeroForOne ? 'gold' : 'silver'
  const got = zeroForOne ? 'silver' : 'gold'
  const steps: Step[] = []
  let state = copy(start)
  const push = (step: Omit<Step, 'state' | 'phase'> & { phase?: Phase }) =>
    steps.push({ phase: 'during', ...step, state: copy(state) })
  const call = `swap(${zeroForOne}, ${amountIn}, ${minAmountOut})`
  const v = {
    zeroForOne: String(zeroForOne), amountIn: String(amountIn), minAmountOut: String(minAmountOut),
    reserve0: String(start.reserve0), reserve1: String(start.reserve1),
  }

  // A refusal reverts before anything changed, so the state stays the one the call found.
  const refuse = (error: string, step: Omit<Step, 'state' | 'phase'>): Trace => {
    push({ ...step, phase: 'reverted' })
    return { steps, result: { tag: 'revert', error, payment: false } }
  }

  push({
    lines: ['signature'], notes: { signature: call }, values: {}, phase: 'before',
    say: `The trader calls ${call}: pay ${fmt(amountIn)} ${paid} and get at least ${fmt(minAmountOut)} ${got}. `
      + `zeroForOne is ${zeroForOne} because gold is token0. Before the call, the trader has let the pool take `
      + `${fmt(start[paid].allowance)} ${paid}.`,
  })

  if (amountIn === 0) {
    return refuse('AmountNotPositive', {
      lines: ['notPositive'], notes: { notPositive: 'true: the model\'s Left AmountNotPositive' }, values: v,
      say: 'amountIn is 0, so the call reverts with AmountNotPositive, as the model returns Left AmountNotPositive. '
        + 'Nothing has changed yet, so the revert has nothing to undo.',
    })
  }
  push({
    lines: ['notPositive'], notes: { notPositive: 'false: the model\'s amountIn <= 0' }, values: v,
    say: `amountIn is ${fmt(amountIn)}, not 0, so the first guard passes. A uint256 can't be negative, `
      + 'so == 0 is the whole of the model\'s amountIn <= 0.',
  })

  if (start.reserve0 === 0 || start.reserve1 === 0) {
    return refuse('EmptyPool', {
      lines: ['empty'], notes: { empty: 'true: the model\'s Left EmptyPool' }, values: v,
      say: 'A reserve is empty, so there is no price. The call reverts with EmptyPool, the model\'s Left EmptyPool.',
    })
  }
  push({
    lines: ['empty'], notes: { empty: 'false: the model\'s EmptyPool guard' }, values: v,
    say: `The books hold ${fmt(start.reserve0)} gold and ${fmt(start.reserve1)} silver, so neither reserve is empty `
      + 'and the second guard passes. The guard reads the books, not the token ledgers.',
  })

  const [reserveIn, reserveOut] = zeroForOne ? [start.reserve0, start.reserve1] : [start.reserve1, start.reserve0]
  push({
    lines: ['pick', 'pick1'], notes: { pick1: `reserveIn ${reserveIn}, reserveOut ${reserveOut}` }, values: v,
    say: `The trader pays ${paid}, so reserveIn is the ${paid} on the books (${fmt(reserveIn)}) and reserveOut `
      + `the ${got} (${fmt(reserveOut)}), as the model's where block picks them.`,
  })

  const exact = (reserveOut * amountIn) / (reserveIn + amountIn)
  const amountOut = Math.floor(exact)
  const vOut = { ...v, reserveIn: String(reserveIn), reserveOut: String(reserveOut), amountOut: String(amountOut) }
  const whole = Number.isInteger(exact)
  push({
    lines: ['keep', 'amountOut'], values: vOut,
    notes: { amountOut: whole ? `${amountOut}` : `${amountOut}, from ${cut(exact)}… rounded down` },
    say: `${fmt(reserveOut)} × ${fmt(amountIn)} / ${fmt(reserveIn + amountIn)} is `
      + (whole ? `${fmt(exact)}.` : `${cut(exact)}…, and / on uint256 rounds it down to ${fmt(amountOut)}, `
        + 'as div does in the model: the pool keeps the fraction.'),
  })

  if (amountOut === 0 || amountOut < minAmountOut) {
    return refuse('OutputTooSmall', {
      lines: ['tooSmall', 'tooSmall1'], values: vOut,
      notes: { tooSmall: 'true', tooSmall1: 'the model\'s Left OutputTooSmall' },
      say: (amountOut === 0
        ? `The swap would pay out nothing for ${fmt(amountIn)} ${paid}. `
        : `The trader asked for at least ${fmt(minAmountOut)} ${got}, and the swap would pay ${fmt(amountOut)}. `)
        + 'The call reverts with OutputTooSmall, the model\'s Left OutputTooSmall. Nothing has changed yet, '
        + 'and the trader keeps their tokens.',
    })
  }
  push({
    lines: ['tooSmall'], values: vOut, notes: { tooSmall: 'false: enough comes out' },
    say: `${fmt(amountOut)} is more than 0` + (minAmountOut > 0 ? ` and at least the ${fmt(minAmountOut)} asked for` : '')
      + ', so the third guard passes. The checks are done.',
  })

  const before = { reserve0: start.reserve0, reserve1: start.reserve1 }
  if (zeroForOne) {
    state.reserve0 = reserveIn + amountIn
    state.reserve1 = reserveOut - amountOut
  } else {
    state.reserve0 = reserveOut - amountOut
    state.reserve1 = reserveIn + amountIn
  }
  push({
    lines: zeroForOne ? ['ifGold', 'gold0', 'gold1'] : ['ifGold', 'otherwise', 'silver0', 'silver1'], values: vOut,
    notes: zeroForOne ? { gold0: `${state.reserve0}`, gold1: `${state.reserve1}` }
      : { ifGold: 'false', silver0: `${state.reserve0}`, silver1: `${state.reserve1}` },
    say: `The pool writes its new books: ${fmt(state.reserve0)} gold and ${fmt(state.reserve1)} silver, the model's `
      + `new Pool. Only the books change. On the tokens' ledgers no gold or silver has moved yet.`,
  })

  const entry = { zeroForOne, amountIn, amountOut }
  state.log.push(entry)
  push({
    lines: ['emit'], notes: { emit: 'a log entry' },
    values: { ...vOut, 'msg.sender': 'trader' },
    say: 'The pool writes a log entry: who traded, which way, and how much went in and out. Wallets read these '
      + 'to learn that a trade happened. A revert would take it back with everything else.',
  })

  const ledgerIn = state[paid]
  const ledgerOut = state[got]
  push({
    lines: ['settled', 'tokens', 'tokens1'], notes: { tokens1: `tokenIn ${paid}, tokenOut ${got}` },
    values: { zeroForOne: v.zeroForOne, token0: 'gold', token1: 'silver' }, pause: true,
    say: `Next the pool calls the tokens, which are other people's contracts. A token that called back into the `
      + `pool here would see books that already show the swap, ${fmt(state.reserve0)} gold and `
      + `${fmt(state.reserve1)} silver, and ledgers that don't yet: the pool still holds ${fmt(state.gold.pool)} `
      + `gold and ${fmt(state.silver.pool)} silver there.`,
  })

  const vPull = { tokenIn: paid, 'msg.sender': 'trader', 'address(this)': 'pool', amountIn: String(amountIn) }
  // OpenZeppelin's transferFrom spends the approval first, then moves the tokens.
  const short = ledgerIn.allowance < amountIn ? 'allowance' : ledgerIn.trader < amountIn ? 'balance' : undefined
  if (short) {
    const allowance = short === 'allowance'
    push({
      lines: ['pull'], values: vPull, phase: 'during',
      notes: {
        pull: allowance ? `reverts: approved ${ledgerIn.allowance}, not ${amountIn}`
          : `reverts: the trader holds ${ledgerIn.trader}`,
      },
      say: allowance
        ? `The ${paid} token checks the approval first. The trader let the pool take ${fmt(ledgerIn.allowance)} `
          + `${paid}, and the pool asks for ${fmt(amountIn)}, so the token reverts with ERC20InsufficientAllowance. `
          + 'safeTransferFrom passes the revert up, and it ends the swap.'
        : `The trader holds only ${fmt(ledgerIn.trader)} ${paid}, and the pool asks for ${fmt(amountIn)}, so the `
          + `${paid} token reverts with ERC20InsufficientBalance. safeTransferFrom passes the revert up, and it ends `
          + 'the swap.',
    })
    state = copy(start)
    push({
      lines: zeroForOne ? ['gold0', 'gold1', 'emit'] : ['silver0', 'silver1', 'emit'], values: {}, phase: 'reverted',
      notes: zeroForOne
        ? { gold0: `back to ${before.reserve0}`, gold1: `back to ${before.reserve1}`, emit: 'undone' }
        : { silver0: `back to ${before.reserve0}`, silver1: `back to ${before.reserve1}`, emit: 'undone' },
      say: `The revert undoes everything the call did: the books are back at ${fmt(before.reserve0)} gold and `
        + `${fmt(before.reserve1)} silver, and the log entry is gone. The approval was set before the call, so it `
        + `stays at ${fmt(start[paid].allowance)}. The books never keep a swap that didn't happen.`,
    })
    return { steps, result: { tag: 'revert', error: allowance ? 'ERC20InsufficientAllowance' : 'ERC20InsufficientBalance', payment: true } }
  }

  ledgerIn.allowance -= amountIn
  ledgerIn.trader -= amountIn
  ledgerIn.pool += amountIn
  push({
    lines: ['pull'], values: vPull, notes: { pull: `${amountIn} ${paid}: trader → pool` },
    say: `The ${paid} token moves ${fmt(amountIn)} ${paid} from the trader to the pool, and spends that much of `
      + `the approval, which leaves ${fmt(ledgerIn.allowance)}. The ${got} ledger hasn't moved yet: it still shows `
      + `the pool holding ${fmt(ledgerOut.pool)} ${got}, while the books already count the payout as gone.`,
  })

  ledgerOut.pool -= amountOut
  ledgerOut.trader += amountOut
  push({
    lines: ['pay'], phase: 'after',
    values: { tokenOut: got, 'msg.sender': 'trader', amountOut: String(amountOut) },
    notes: { pay: `${amountOut} ${got}: pool → trader` },
    say: `The ${got} token moves ${fmt(amountOut)} ${got} from the pool to the trader, and swap returns `
      + `${fmt(amountOut)}: the model's Right (${amountOut}, Pool ${state.reserve0} ${state.reserve1}). `
      + offBooks(state),
  })
  return { steps, result: { tag: 'ok', amountOut, state } }
}

// What the ledgers hold for the pool beyond its books: what was sent to it directly.
function offBooks(s: State): string {
  const extra = ([['gold', s.gold.pool - s.reserve0], ['silver', s.silver.pool - s.reserve1]] as const)
    .filter(([, n]) => n > 0).map(([token, n]) => `${fmt(n)} ${token}`)
  return extra.length === 0 ? 'The books and the ledgers agree again.'
    : `The ledgers still show ${extra.join(' and ')} more in the pool than its books: what was sent to it directly `
      + 'stays off them.'
}

// An output before rounding, cut to two places rather than rounded, so it never looks like the
// whole number it rounds down from.
const cut = (n: number) => (Math.floor(n * 100 + 1e-9) / 100).toFixed(2)
