import { escape } from '../code'
import '../widget.css'
import './checks.css'
import { type Fact, type PoolKind, type Run, payoutChecks, properties, propertyKeys, runProperties } from './checksModel'

const runs = 200
const payouts = [
  { label: 'Honest', out: 5000n },
  { label: 'One unit less', out: 4999n },
  { label: 'Keeps a thousandth', out: 4995n },
  { label: 'One unit more', out: 5001n },
]
const assertions = [
  { label: 'The product does not fall', code: 'assertGe((reserveA + amountIn) * (reserveB - amountOut), product);' },
  { label: 'One more unit would lower it', code: 'assertLt((reserveA + amountIn) * (reserveB - amountOut - 1), product);' },
]
const number = (n: bigint | number) => n.toLocaleString('en-US')
const facts = (items: Fact[]) => `<dl class="checks-facts">${items.map(({ label, value }) =>
  `<div><dt>${escape(label)}</dt><dd>${escape(typeof value === 'bigint' ? number(value) : value)}</dd></div>`).join('')}</dl>`

export function mountEvmChecks(root: HTMLElement) {
  let selected: number | null = null
  let predictions: (boolean | null)[] = [null, null]
  let revealed = false
  let kind: PoolKind = 'honest'
  let seed = 1
  let results: Run[] | null = null

  root.classList.add('amm', 'amm-checks')
  root.innerHTML = `
    <p class="checks-note">The tests’ checks, re-implemented in TypeScript. No Solidity runs here.</p>
    <section class="checks-part" aria-label="One swap, two checks">
      <h3>One swap, two checks</h3>
      <p>Pool: <b>10,000 gold / 10,000 silver</b>. Pay in <b>10,000 gold</b>.</p>
      <fieldset class="checks-payouts">
        <legend>What does the pool pay in silver?</legend>
        <div class="checks-choices">${payouts.map((p, i) => `<button type="button" data-payout="${i}" aria-pressed="false">
          <span>${p.label}</span><b>${number(p.out)}</b></button>`).join('')}</div>
      </fieldset>
      <p class="checks-prompt">Predict whether each assertion passes or fails, then reveal.</p>
      <div class="checks-predictions" data-waiting>${assertions.map((a, i) => `
        <fieldset class="checks-assertion">
          <legend>${a.label}</legend>
          <code>${escape(a.code)}</code>
          <div class="checks-answer">
            <div class="tg" role="group" aria-label="Prediction: ${a.label}">
              <button type="button" data-check="${i}" data-answer="pass" aria-pressed="false" disabled>Pass</button>
              <button type="button" data-check="${i}" data-answer="fail" aria-pressed="false" disabled>Fail</button>
            </div>
            <span class="checks-verdict" data-verdict="${i}"></span>
          </div>
        </fieldset>`).join('')}</div>
      <div class="checks-actions">
        <button type="button" class="btn p" data-act="reveal" disabled>Reveal checks</button>
        <span class="checks-note" data-prediction-hint>Choose a payout, then both predictions.</span>
      </div>
      <div class="checks-reveal" aria-live="polite" aria-atomic="true"></div>
    </section>
    <section class="checks-part" aria-label="Run the properties">
      <h3>Run the properties</h3>
      <p>Each check tries ${runs} of its own random cases on fresh pools. Reserves and inputs range from
        10,000 to 1,000,000,000 units, so a thousandth of the payout is usually at least one unit.</p>
      <div class="checks-controls">
        <div class="tg checks-mode" role="group" aria-label="Pool behavior">
          <button type="button" data-kind="honest" aria-pressed="true">Honest pool</button>
          <button type="button" data-kind="thousandth" aria-pressed="false">Keeps a thousandth</button>
        </div>
        <div class="checks-seed"><span data-seed></span>
          <button type="button" class="btn" data-act="seed">New seed</button>
          <button type="button" class="btn p" data-act="run">Run</button>
        </div>
      </div>
      <p class="checks-note" data-run-summary role="status" aria-live="polite"></p>
      <ul class="checks-results"></ul>
      <p class="checks-note">Same seed, same cases in either pool. Zero-output swaps must be refused, then
        their cases are discarded and replaced. On rare cases the larger-trades check also catches the pool that
        keeps a thousandth.</p>
    </section>`

  const $ = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!

  function renderPrediction() {
    for (const b of root.querySelectorAll<HTMLButtonElement>('[data-payout]')) {
      b.setAttribute('aria-pressed', String(Number(b.dataset.payout) === selected))
    }
    for (const b of root.querySelectorAll<HTMLButtonElement>('[data-check]')) {
      const answer = b.dataset.answer === 'pass'
      b.setAttribute('aria-pressed', String(predictions[Number(b.dataset.check)] === answer))
      b.disabled = selected === null || revealed
    }
    $('.checks-predictions').toggleAttribute('data-waiting', selected === null)
    const ready = selected !== null && predictions.every((p) => p !== null)
    const button = $<HTMLButtonElement>('[data-act="reveal"]')
    button.disabled = !ready || revealed
    button.textContent = revealed ? 'Checks revealed' : 'Reveal checks'
    $('[data-prediction-hint]').textContent = revealed ? 'Choose another payout to predict again.'
      : ready ? 'Ready to reveal.' : selected === null ? 'Choose a payout, then both predictions.' : 'Choose both predictions.'
    if (selected === null) return

    const k = payoutChecks(10_000n, 10_000n, 10_000n, payouts[selected].out)
    const passed = [k.keepsProduct, k.isLargest]
    for (let i = 0; i < assertions.length; i++) {
      const el = $(`[data-verdict="${i}"]`)
      el.textContent = revealed ? `${passed[i] ? 'Pass' : 'Fail'} · prediction ${predictions[i] === passed[i] ? 'correct' : 'incorrect'}` : ''
      el.dataset.status = revealed ? (passed[i] ? 'passed' : 'failed') : ''
    }
    $('.checks-reveal').innerHTML = revealed ? facts([
      { label: 'Product before', value: k.before },
      { label: 'Product after payout', value: k.after },
      { label: 'Product with one more paid', value: k.oneMore },
    ]) + `<p>${!k.keepsProduct ? 'Paid too much: the product fell.'
      : !k.isLargest ? 'Paid too little: one more unit would still keep the product.'
        : 'Both pass: this payout keeps the product; one more unit would lower it.'}</p>` : ''
  }

  function renderRuns() {
    for (const b of root.querySelectorAll<HTMLButtonElement>('[data-kind]')) {
      b.setAttribute('aria-pressed', String(b.dataset.kind === kind))
    }
    $('[data-seed]').textContent = `Seed ${seed}`
    const failed = results?.filter((r) => r.status === 'failed').length ?? 0
    const passed = results?.filter((r) => r.status === 'passed').length ?? 0
    $('[data-run-summary]').textContent = results
      ? `${kind === 'honest' ? 'Honest pool' : 'Pool that keeps a thousandth'}, seed ${seed}: ${passed} passed, ${failed} failed.`
        + (passed + failed < propertyKeys.length ? ' Some runs could not find enough paying swaps.' : '')
      : 'Ready. Run to check this pool.'
    $('.checks-results').innerHTML = propertyKeys.map((key, i) => {
      const r = results?.[i]
      const label = !r ? '–' : r.status === 'passed' ? `Passed · ${r.passed}/${runs}`
        : r.status === 'failed' ? `Failed · case ${r.passed + 1}` : `Incomplete · ${r.passed}/${runs}`
      const failure = r?.failure
      return `<li>
        <div class="checks-result-heading"><span>${properties[key]}</span>
          <b class="checks-verdict" data-status="${r?.status ?? 'rest'}"${r ? '' : ' aria-hidden="true"'}>${label}</b></div>
        ${failure ? `<details open><summary>First failing case</summary>
          <p>${escape(failure.reason)}</p>${facts(failure.facts)}</details>` : ''}
        ${r && r.discarded > 0 ? `<p class="checks-note">${r.discarded} zero-output case${r.discarded === 1 ? '' : 's'} discarded.</p>` : ''}
      </li>`
    }).join('')
  }

  root.addEventListener('click', (event) => {
    const b = (event.target as HTMLElement).closest<HTMLButtonElement>('button')
    if (!b || !root.contains(b) || b.disabled) return
    const { payout, check, answer, act, kind: mode } = b.dataset
    if (payout !== undefined) {
      selected = Number(payout)
      predictions = [null, null]
      revealed = false
      renderPrediction()
    } else if (check !== undefined) {
      predictions[Number(check)] = answer === 'pass'
      renderPrediction()
    } else if (act === 'reveal') {
      revealed = true
      renderPrediction()
    } else if (mode === 'honest' || mode === 'thousandth') {
      kind = mode
      results = null
      renderRuns()
    } else if (act === 'seed') {
      seed = (seed + 1) >>> 0
      results = null
      renderRuns()
    } else if (act === 'run') {
      results = runProperties(seed, kind, runs)
      renderRuns()
    }
  })

  renderPrediction()
  renderRuns()
}
