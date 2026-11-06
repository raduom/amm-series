import '../widget.css'
import './rounding.css'
import { type Owed, type Pool, decimal, honest, pays, productCheck, withFee } from './roundingModel'

interface Inputs { reserveIn: bigint; reserveOut: bigint; amountIn: bigint }
const presets: Inputs[] = [
  { reserveIn: 1_000n, reserveOut: 4_000n, amountIn: 100n }, // the post's worked example
  { reserveIn: 100n, reserveOut: 100n, amountIn: 100n },     // nothing rounds
]
const fields = [
  { key: 'reserveIn', label: 'Gold in the pool', token: 'gold' },
  { key: 'reserveOut', label: 'Silver in the pool', token: 'silver' },
  { key: 'amountIn', label: 'Gold paid in', token: 'gold' },
] as const
const max = 1_000_000_000n
const number = (n: bigint) => n.toLocaleString('en-US')
const preset = (p: Inputs) => `${number(p.reserveIn)} / ${number(p.reserveOut)} / ${number(p.amountIn)}`

// What a preset shows, so its label tells the reader why it is worth a click.
function outcome(p: Inputs) {
  const pool: Pool = { reserveIn: p.reserveIn, reserveOut: p.reserveOut }
  const a = pays(honest(pool, p.amountIn))
  const b = pays(withFee(pool, p.amountIn))
  return a === b ? `same ${number(a)}` : `${number(a)} against ${number(b)}`
}

function owed(o: Owed) {
  const d = decimal(o)
  return `${number(d.whole)}.${d.frac}${d.cut ? '…' : ''}`
}

export function mountTestsRounding(root: HTMLElement) {
  let state: Inputs = { ...presets[0] }

  root.classList.add('amm', 'amm-rounding')
  root.innerHTML = `
    <div class="hd">
      <div class="tg" role="group" aria-label="Example pools: gold / silver / gold paid in">
        ${presets.map((p, i) => `<button type="button" data-preset="${i}" aria-pressed="false">${preset(p)} · ${outcome(p)}</button>`).join('')}
      </div>
      <button type="button" class="mini" data-act="reset">Reset</button>
    </div>
    <div class="rounding-inputs">${fields.map((f) => `
      <label><span><i class="rounding-dot ${f.token}"></i>${f.label}</span>
        <input type="text" inputmode="numeric" autocomplete="off" spellcheck="false" data-in="${f.key}"></label>`).join('')}
    </div>
    <table class="rounding-rows">
      <thead><tr><th scope="col"><span class="rounding-sr">Pool</span></th><th scope="col">Owed</th><th scope="col">Pays</th></tr></thead>
      <tbody>
        <tr data-row="honest"><th scope="row">Honest pool</th><td data-owed></td><td data-pays></td></tr>
        <tr data-row="fee"><th scope="row">Pool with the 0.1% fee</th><td data-owed></td><td data-pays></td></tr>
      </tbody>
    </table>
    <p class="rounding-verdict" role="status" aria-live="polite"></p>
    <section class="rounding-check" aria-label="The largest output that keeps the product">
      <h3>The largest output that keeps the product</h3>
      <dl class="rounding-facts"></dl>
      <p class="rounding-check-verdict"></p>
      <p class="rounding-hint" hidden>The fee is hidden on this pool. The second example is where the check fails it.</p>
    </section>`

  const $ = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!
  const inputs = [...root.querySelectorAll<HTMLInputElement>('[data-in]')]

  function fill() {
    for (const input of inputs) {
      input.value = number(state[input.dataset.in as keyof Inputs])
      input.removeAttribute('aria-invalid')
    }
  }

  function render() {
    for (const b of root.querySelectorAll<HTMLButtonElement>('[data-preset]')) {
      const p = presets[Number(b.dataset.preset)]
      b.setAttribute('aria-pressed', String(fields.every(({ key }) => p[key] === state[key])))
    }
    const pool: Pool = { reserveIn: state.reserveIn, reserveOut: state.reserveOut }
    const owedHonest = honest(pool, state.amountIn)
    const owedFee = withFee(pool, state.amountIn)
    const outHonest = pays(owedHonest)
    const outFee = pays(owedFee)
    const paid = (out: bigint) => out === 0n ? '<span class="rounding-refused">0, refused</span>' : number(out)
    for (const [row, o, out] of [['honest', owedHonest, outHonest], ['fee', owedFee, outFee]] as const) {
      $(`[data-row="${row}"] [data-owed]`).textContent = owed(o)
      $(`[data-row="${row}"] [data-pays]`).innerHTML = paid(out)
    }

    const verdict = $('.rounding-verdict')
    const same = outHonest === outFee
    verdict.dataset.status = same ? 'same' : 'different'
    verdict.textContent = same
      ? (outHonest === 0n ? 'Both pay nothing, so both refuse the swap: a worked example can’t tell them apart.'
        : 'Same payout: a worked example can’t tell them apart.')
      : `Different: ${number(outHonest)} against ${number(outFee)}.`

    const facts = $('.rounding-facts')
    const checkVerdict = $('.rounding-check-verdict')
    const hint = $('.rounding-hint')
    hint.hidden = true
    if (outFee === 0n) {
      facts.innerHTML = ''
      checkVerdict.dataset.status = ''
      checkVerdict.textContent = 'The pool with the fee would pay nothing, so it refuses the swap and there is no payout to check.'
      return
    }
    const k = productCheck(pool, state.amountIn, outFee)
    facts.innerHTML = [
      ['Product before', k.before],
      [`After paying ${number(outFee)}`, k.after],
      [`After paying ${number(outFee + 1n)}`, k.oneMore],
    ].map(([label, value]) => `<div><dt>${label}</dt><dd>${number(value as bigint)}</dd></div>`).join('')
    checkVerdict.dataset.status = k.isLargest ? 'passed' : 'failed'
    hint.hidden = !(same && k.isLargest)
    checkVerdict.textContent = k.isLargest
      ? `One more unit would lower the product, so ${number(outFee)} is the largest: this check passes the pool with the fee too.`
      : `Paying ${number(outFee + 1n)} still keeps the product, so ${number(outFee)} is not the largest: the check fails the pool with the fee.`
  }

  root.addEventListener('input', (event) => {
    const input = event.target as HTMLInputElement
    const key = input.dataset.in as keyof Inputs | undefined
    if (!key) return
    const text = input.value.replace(/[,_\s]/g, '')
    const value = /^\d+$/.test(text) ? BigInt(text) : 0n
    const ok = value >= 1n && value <= max
    input.toggleAttribute('aria-invalid', !ok)
    if (!ok) return
    state = { ...state, [key]: value }
    render()
  })
  // Once the reader leaves a field, show what the widget is using.
  root.addEventListener('change', (event) => {
    const input = event.target as HTMLInputElement
    const key = input.dataset.in as keyof Inputs | undefined
    if (!key) return
    input.value = number(state[key])
    input.removeAttribute('aria-invalid')
  })
  root.addEventListener('click', (event) => {
    const b = (event.target as HTMLElement).closest<HTMLButtonElement>('button')
    if (!b || !root.contains(b)) return
    if (b.dataset.preset !== undefined) state = { ...presets[Number(b.dataset.preset)] }
    else if (b.dataset.act === 'reset') state = { ...presets[0] }
    else return
    fill()
    render()
  })

  fill()
  render()
}
