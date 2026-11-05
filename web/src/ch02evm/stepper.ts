import source from '../../../evm/src/ConstantProductPool.sol?raw'
import { escape } from '../code'
import { locate } from '../source'
import '../widget.css'
import { type Highlight, solidityPanel } from './solidity'
import './stepper.css'
import { type Call, type Entry, type Ledger, type State, type Trace, copy, fmt, lines, trace } from './stepperTrace'

// The pool as the contract's tests open it, and a trader who holds and has approved enough.
const start: State = {
  reserve0: 1000,
  reserve1: 1000,
  gold: { trader: 1000, pool: 1000, allowance: 1000 },
  silver: { trader: 1000, pool: 1000, allowance: 1000 },
  log: [],
}
const gift = 500

const template = `
  <div class="hd">
    <p class="evm-lbl">The contract's swap re-done in TypeScript, step by step. It isn't the contract running.</p>
    <button class="mini" data-act="reset">Reset</button>
  </div>
  <div class="ctl stack">
    <label class="amt">amountIn <input data-in="amountIn" type="range" min="0" max="200" step="1"><b></b></label>
    <label class="amt">minAmountOut <input data-in="minAmountOut" type="range" min="0" max="200" step="1"><b></b></label>
    <label class="amt"><span class="evm-approve"></span> <input data-in="approve" type="range" min="0" max="1000" step="10"><b></b></label>
    <div class="tg" role="group" aria-label="Which token the trader pays">
      <button data-dir="gold">gold → silver</button><button data-dir="silver">silver → gold</button>
    </div>
    <button class="btn p" data-act="swap">Apply swap</button>
    <p class="evm-how">Use Next step, under the code, to walk through this swap. Lower the approval or raise the minimum to see it revert; Apply swap keeps the new pool so you can try another.</p>
    <div class="evm-gifts">
      <button class="btn" data-act="gift" data-token="gold">Send ${gift} gold to the pool directly</button>
      <button class="btn" data-act="gift" data-token="silver">Send ${gift} silver to the pool directly</button>
    </div>
    <p class="quote" aria-live="polite"></p>
  </div>
  <div class="evm-rec">
    <p class="evm-trace" hidden>Next swap, from the updated pool</p>
    <p class="evm-when"></p>
    <div class="evm-cards">
      <section class="evm-card evm-books"><h4>The pool's books</h4><dl></dl></section>
      <section class="evm-card" data-token="gold"><h4>Gold token's ledger</h4><dl></dl></section>
      <section class="evm-card" data-token="silver"><h4>Silver token's ledger</h4><dl></dl></section>
    </div>
    <div class="evm-log"><span>Log</span><div></div></div>
  </div>
  <div class="code"></div>
  <div class="ex">
    <div class="steps">
      <button class="btn" data-act="prev"><span aria-hidden="true">◀</span> Previous step</button>
      <div class="dots"></div>
      <button class="btn" data-act="next">Next step <span aria-hidden="true">▶</span></button>
    </div>
    <p class="say" aria-live="polite"></p>
  </div>`

export function mountEvmStepper(root: HTMLElement) {
  const src = source.split('\n')
  const at = locate(source, lines)
  // The listing is swap, from its signature to its closing brace, without the contract's indentation.
  const from = at.signature
  const to = src.findIndex((l, i) => i > at.pay && l === '    }')
  const listing = src.slice(from, to + 1).map((l) => l.replace(/^ {4}/, ''))
  root.classList.add('amm', 'evm')
  root.innerHTML = template
  const $ = <T extends HTMLElement>(selector: string) => root.querySelector(selector) as T
  const sliders = [...root.querySelectorAll<HTMLInputElement>('[data-in]')]

  let state = copy(start)
  let call: Call = { zeroForOne: true, amountIn: 100, minAmountOut: 0 }
  // What the last button did, until the controls change.
  let told: string | undefined
  let swapped = false // the last button applied a swap, so the trace is the next swap, from the updated pool
  let t: Trace
  let step = 0

  const paid = () => (call.zeroForOne ? 'gold' : 'silver')

  function load() {
    t = trace(call, state)
    step = 0
    panel.follow()
  }

  function highlight(): Highlight {
    const s = t.steps[step]
    const notes = new Map<number, string>()
    for (const [line, note] of Object.entries(s.notes)) notes.set(at[line as keyof typeof lines] - from, note!)
    return { focus: s.lines.map((l) => at[l] - from), notes, values: s.values }
  }

  function render() {
    const token = paid()
    $('[data-dir="gold"]').setAttribute('aria-pressed', String(call.zeroForOne))
    $('[data-dir="silver"]').setAttribute('aria-pressed', String(!call.zeroForOne))
    $('.evm-approve').textContent = `${token}.approve`
    for (const s of sliders) {
      const v = s.dataset.in === 'approve' ? state[token].allowance : call[s.dataset.in as 'amountIn' | 'minAmountOut']
      if (s.valueAsNumber !== v) s.value = String(v)
      s.nextElementSibling!.textContent = String(v)
    }
    $<HTMLButtonElement>('[data-act="swap"]').disabled = t.result.tag === 'revert'
    for (const b of root.querySelectorAll<HTMLButtonElement>('[data-act="gift"]')) {
      b.disabled = state[b.dataset.token as 'gold' | 'silver'].trader < gift
    }
    // The payout stays hidden until the trace reaches the line that works it out.
    const priced = t.steps.slice(0, step + 1).some((s) => s.lines.includes('amountOut'))
    $('.quote').innerHTML = (told ? `${told} ` : '') + quote(call, t, swapped, priced)
    $('.evm-trace').hidden = !swapped

    const s = t.steps[step]
    const before = t.steps[Math.max(0, step - 1)].state
    drawRecords(s.state, before)
    const when = $('.evm-when')
    when.textContent = s.phase === 'before' ? 'Before the call'
      : s.phase === 'reverted' ? 'The call reverted: nothing it did is kept'
      : s.phase === 'after' ? 'After the call'
      : s.pause ? 'In the call: the books are ahead of the ledgers'
      : 'In the call'
    when.dataset.phase = s.pause ? 'pause' : s.phase

    panel.show(listing, highlight())
    $('.dots').innerHTML = t.steps.map((_, i) => `<i class="${i <= step ? 'on' : ''}"></i>`).join('')
    $('.say').textContent = s.say
    $<HTMLButtonElement>('[data-act="prev"]').disabled = step === 0
    $<HTMLButtonElement>('[data-act="next"]').disabled = step === t.steps.length - 1
  }

  function drawRecords(now: State, was: State) {
    $('.evm-books dl').innerHTML = row('gold <code>reserve0</code>', now.reserve0, was.reserve0)
      + row('silver <code>reserve1</code>', now.reserve1, was.reserve1)
    for (const token of ['gold', 'silver'] as const) {
      const [a, b]: Ledger[] = [now[token], was[token]]
      $(`.evm-card[data-token="${token}"] dl`).innerHTML = row('trader', a.trader, b.trader)
        + row('pool', a.pool, b.pool) + row('approved', a.allowance, b.allowance)
    }
    // The newest entries, and one this step took back.
    const shown = now.log.slice(-2).map((e) => `<code>${entry(e)}</code>`)
    if (was.log.length > now.log.length) shown.push(`<code class="gone">${entry(was.log[was.log.length - 1])}</code>`)
    else if (now.log.length > was.log.length) shown[shown.length - 1] = shown[shown.length - 1].replace('<code>', '<code class="new">')
    const earlier = Math.max(0, now.log.length - 2)
    $('.evm-log div').innerHTML = shown.length === 0 ? '<span class="none">no entries</span>'
      : (earlier ? `<span class="none">${earlier} earlier</span>` : '') + shown.join('')
  }

  const actions: Record<string, (b: HTMLElement) => void> = {
    swap() {
      if (t.result.tag !== 'ok') return
      const got = call.zeroForOne ? 'silver' : 'gold'
      state = copy(t.result.state)
      swapped = true
      told = `Swapped: the trader paid ${fmt(call.amountIn)} ${paid()} and got <b>${fmt(t.result.amountOut)} ${got}</b>.`
    },
    gift(b) {
      const token = b.dataset.token as 'gold' | 'silver'
      state[token].trader -= gift
      state[token].pool += gift
      const books = token === 'gold' ? state.reserve0 : state.reserve1
      told = `The trader sent ${gift} ${token} with the ${token} token's transfer, without calling the pool. `
        + `The ledger shows the pool holding ${fmt(state[token].pool)}; its books still say ${fmt(books)}.`
    },
    reset() {
      state = copy(start)
      told = undefined
    },
  }

  root.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('button')
    if (!b || b.disabled) return
    const { act, dir } = b.dataset
    if (dir) {
      call = { ...call, zeroForOne: dir === 'gold' }
      told = undefined
      swapped = false
      load()
    } else if (act === 'prev' || act === 'next') {
      step = Math.max(0, Math.min(t.steps.length - 1, step + (act === 'next' ? 1 : -1)))
      panel.follow()
    } else if (act) {
      swapped = false
      actions[act](b)
      load()
    }
    render()
  })

  for (const s of sliders) {
    s.addEventListener('input', () => {
      if (s.dataset.in === 'approve') state[paid()].allowance = s.valueAsNumber
      else call = { ...call, [s.dataset.in!]: s.valueAsNumber }
      told = undefined
      swapped = false
      load()
      render()
    })
  }

  const panel = solidityPanel($('.code'), 'ConstantProductPool.sol')
  load()
  render()

  return {
    setOptions() {},
  }
}

// A figure, and what it was before this step if the step changed it.
function row(label: string, now: number, was: number): string {
  const changed = now !== was
  return `<dt>${label}</dt><dd${changed ? ' class="chg"' : ''}>`
    + (changed ? `<s>${fmt(was)}</s> ` : '') + `${fmt(now)}</dd>`
}

const entry = (e: Entry) => escape(`Swap(trader, ${e.zeroForOne}, ${e.amountIn}, ${e.amountOut})`)

// What the call the controls describe would do, or where it would revert.
function quote(c: Call, t: Trace, again: boolean, priced: boolean): string {
  const paid = c.zeroForOne ? 'gold' : 'silver'
  const got = c.zeroForOne ? 'silver' : 'gold'
  const r = t.result
  if (r.tag === 'ok') {
    if (!priced) return `Step through to see what ${again ? 'the same swap pays now' : 'this swap pays'}.`
    return `${again ? 'The same swap again' : 'This swap'} pays <b>${fmt(r.amountOut)} ${got}</b>.`
  }
  const no = `<span class="no">${again ? 'The same swap again reverts' : 'Reverts'}:</span>`
  switch (r.error) {
    case 'AmountNotPositive': return `${no} pay a positive amount.`
    case 'EmptyPool': return `${no} a reserve is empty.`
    case 'OutputTooSmall': {
      const { reserve0, reserve1 } = t.steps[0].state
      const [rin, rout] = c.zeroForOne ? [reserve0, reserve1] : [reserve1, reserve0]
      const out = Math.floor((rout * c.amountIn) / (rin + c.amountIn))
      return out === 0 ? `${no} it would pay nothing.`
        : `${no} it would pay ${fmt(out)} ${got}, and the trader asks for at least ${fmt(c.minAmountOut)}.`
    }
    case 'ERC20InsufficientAllowance':
      return `${no} the pool may take only ${fmt(t.steps[0].state[paid].allowance)} ${paid}, and the swap asks for `
        + `${fmt(c.amountIn)}. Step through to see the payment fail.`
    default:
      return `${no} the trader holds only ${fmt(t.steps[0].state[paid].trader)} ${paid}. Step through to see the payment fail.`
  }
}
