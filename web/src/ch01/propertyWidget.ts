import source from '../../../model/test/AMM/ConstantSumProperties.hs?raw'
import { type Highlight, escape } from '../code'
import { codePanel } from '../panel'
import '../widget.css'
import { showPool, showSwap } from './model'
import { type Property, excerpts, properties } from './propertyLines'
import { type Trace, cases, trace } from './propertyTrace'
import type { Options } from './widget'

const runs = 100
// A seed whose first case is a swap that succeeds, so the first reading checks something.
const seed = 5

const template = `
  <div class="hd">
    <div class="tg wide" role="tablist" aria-label="Property"></div>
  </div>
  <div class="ctl">
    <div class="case"></div>
    <button class="btn" data-act="next-case">Next case</button>
    <button class="btn" data-act="run">Run ${runs}</button>
  </div>
  <div class="code"></div>
  <div class="ex">
    <div class="steps">
      <button class="btn" data-act="prev" aria-label="Previous step">◀</button>
      <div class="dots"></div>
      <button class="btn" data-act="next" aria-label="Next step">▶</button>
    </div>
    <p class="say" aria-live="polite"></p>
  </div>
  <div class="tally"></div>`

export function mountCh01Properties(root: HTMLElement, options: Options) {
  const shown = excerpts(source)
  const keys = Object.keys(properties) as Property[]
  const made = cases(seed, runs)
  root.classList.add('amm')
  root.innerHTML = template
  const $ = <T extends HTMLElement>(selector: string) => root.querySelector(selector) as T
  $('.tg').innerHTML = keys.map((k) => `<button role="tab" data-prop="${k}">${properties[k].label}</button>`).join('')

  let opts = options
  let property: Property = 'sum'
  // The case being read, and which step of it.
  let ci = 0
  let t: Trace
  let step = 0
  // The whole run went by, so its result shows.
  let ran = false

  const listing = (p: Property) => ({ src: shown[p].src, from: 0, folds: [shown[p].fold] })
  // The longest notes: every step of the first and the last case that has a swap to check.
  const checked = made.filter((c) => trace('sum', c).checked)
  const samples = () => keys.flatMap((p) => [checked[0], checked[checked.length - 1]].flatMap((c) => {
    const r = trace(p, c)
    return r.steps.map((_, i) => ({ listing: listing(p), hl: highlight(p, r, i) }))
  }))
  const panel = codePanel($('.code'), 'ConstantSumProperties.hs', keys.map(listing), render, samples)

  function load(toEnd = false) {
    t = trace(property, made[ci])
    step = toEnd ? t.steps.length - 1 : 0
    panel.follow()
  }

  function highlight(p: Property, r: Trace, i: number): Highlight {
    const s = r.steps[i]
    const line = shown[p][s.line]
    const note = opts.values ? s.note : (s.named ?? s.note)
    return { focus: [line], uses: [], notes: new Map([[line, note]]), values: r.values, fill: opts.values }
  }

  function render() {
    for (const b of root.querySelectorAll<HTMLElement>('[data-prop]')) {
      b.setAttribute('aria-selected', String(b.dataset.prop === property))
    }
    const c = made[ci]
    $('.case').innerHTML = `<span><span class="m">pool =</span> ${escape(showPool(c.pool))}</span>`
      + `<span><span class="m">s =</span> ${escape(showSwap(c.swap))}</span>`
      + `<span class="count">case ${ci + 1} of ${runs}</span>`
    $<HTMLButtonElement>('[data-act="next-case"]').disabled = ci === runs - 1
    $('[data-act="run"]').textContent = ran ? 'Start over' : `Run ${runs}`
    panel.show(listing(property), highlight(property, t, step))
    $('.dots').innerHTML = t.steps.map((_, i) => `<i class="${i <= step ? 'on' : ''}"></i>`).join('')
    $('.say').textContent = t.steps[step].say
    $<HTMLButtonElement>('[data-act="prev"]').disabled = step === 0
    $<HTMLButtonElement>('[data-act="next"]').disabled = step === t.steps.length - 1
    $('.tally').innerHTML = ran ? tally() : ''
  }

  // What the whole run comes to, in the line `cabal test` prints for it.
  function tally(): string {
    const all = made.map((c) => trace(property, c))
    const failed = all.findIndex((r) => !r.passed)
    if (failed >= 0) return `<pre>*** Failed! (after ${failed + 1} tests)</pre>`
    const checked = all.filter((r) => r.checked).length
    return `<pre>+++ OK, passed ${runs} tests (${(100 * checked / runs).toFixed(2)}% swap succeeds).</pre>`
      + `<p>All ${runs} cases passed.</p>`
  }

  const actions: Record<string, () => void> = {
    'next-case'() {
      ci++
      load()
    },
    run() {
      if (ran) {
        ran = false
        ci = 0
        load()
      } else {
        ran = true
        ci = runs - 1
        load(true)
      }
    },
    prev() {
      step = Math.max(0, step - 1)
      panel.follow()
    },
    next() {
      step = Math.min(t.steps.length - 1, step + 1)
      panel.follow()
    },
  }

  root.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('button')
    // The code panel handles its own buttons.
    if (!b || b.disabled || b.closest('.code')) return
    const { act, prop } = b.dataset
    if (prop) {
      property = prop as Property
      load(ran)
    } else if (act) {
      actions[act]()
    }
    render()
  })

  load()
  render()

  return {
    setOptions(o: Options) {
      opts = o
      panel.fit()
      render()
    },
  }
}
