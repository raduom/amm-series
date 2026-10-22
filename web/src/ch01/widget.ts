import source from '../../../model/src/AMM/ConstantSum.hs?raw'
import { type Highlight, escape, foldsIn } from '../code'
import { codePanel } from '../panel'
import { locate } from '../source'
import '../widget.css'
import { lines } from './lines'
import { type Pool, type Swap, showSwap, showPool, showResult } from './model'
import { choices, questions } from './questions'
import { type Trace, trace } from './trace'

export interface Options {
  values: boolean // write values over the names on the highlighted lines
}

const start: Pool = { reserve0: 100, reserve1: 100 }

const template = `
  <div class="hd">
    <div class="tg" role="tablist" aria-label="Mode">
      <button role="tab" data-mode="play">Play</button>
      <button role="tab" data-mode="predict">Predict the result</button>
    </div>
    <button class="mini" data-act="reset">Reset</button>
    <span class="score"></span>
  </div>
  <div class="pool">
    <div class="sum"></div>
    <div class="bar"><div class="seg a"></div><div class="seg b"></div><div class="was"></div></div>
  </div>
  <div class="ctl">
    <div class="tg" role="group" aria-label="Which token you pay">
      <button data-dir="a">A → B</button><button data-dir="b">B → A</button>
    </div>
    <label class="amt">amountIn <input type="range" min="0" max="200" step="1"><b></b></label>
    <button class="btn p" data-act="swap">Swap</button>
    <button class="btn" data-act="back">Swap back</button>
  </div>
  <div class="quiz">
    <p class="q">What does this return?</p>
    <div class="call"></div>
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
  <div class="answers">
    <div class="opts"></div>
    <div class="fb"></div>
  </div>`

export function mountCh01(root: HTMLElement, options: Options) {
  const src = source.split('\n')
  const at = locate(source, lines)
  const listing = { src, from: at.start, folds: foldsIn(src, at.start) }
  root.classList.add('amm')
  root.innerHTML = template
  const $ = <T extends HTMLElement>(selector: string) => root.querySelector(selector) as T
  const slider = $<HTMLInputElement>('.amt input')

  let opts = options
  let mode: 'play' | 'predict' = 'play'
  // Play: the pool, and the swap the controls describe. The code shows that swap.
  let pool = start
  let was: Pool | undefined
  let pending: Swap = { zeroForOne: true, amountIn: 10 }
  let last: { swap: Swap; amountOut: number } | undefined
  // Predict.
  let qi = 0
  let picked: string | undefined
  let showing = false
  let answered = 0
  let right = 0
  // The swap being read, and which step of it.
  let t: Trace
  let step = 0

  function load(fromStart: boolean) {
    t = mode === 'play' ? trace(pending, pool) : trace(questions[qi].swap, questions[qi].pool)
    step = fromStart ? 0 : t.steps.length - 1
    panel.follow()
  }

  function highlight(): Highlight {
    const s = t.steps[step]
    const focus = [s.line, ...(s.more ?? [])].map((l) => at[l])
    const notes = new Map<number, string>()
    notes.set(focus[focus.length - 1], opts.values || !s.calc ? s.note : `${s.calc} → ${s.note}`)
    if (!opts.values) for (const u of s.uses) notes.set(at[u], t.values[u])
    return { focus, uses: s.uses.map((u) => at[u]), notes, values: t.values, fill: opts.values }
  }

  function drawPool(p: Pool, before?: Pool) {
    const sum = p.reserve0 + p.reserve1
    const a = (p.reserve0 / sum) * 100
    $('.sum').textContent = `reserve0 + reserve1 = ${sum}`
    const segA = $('.seg.a')
    const segB = $('.seg.b')
    segA.style.width = `${a}%`
    segB.style.width = `${100 - a}%`
    segA.innerHTML = `${p.reserve0} A<small>reserve0</small>`
    segB.innerHTML = `<small>reserve1</small>${p.reserve1} B`
    segA.dataset.size = size(a)
    segB.dataset.size = size(100 - a)
    const wasEl = $('.was')
    wasEl.hidden = !before
    if (before) wasEl.style.left = `${(before.reserve0 / sum) * 100}%`
  }

  function render() {
    const play = mode === 'play'
    for (const b of root.querySelectorAll<HTMLElement>('[data-mode]')) {
      b.setAttribute('aria-selected', String(b.dataset.mode === mode))
    }
    $('[data-act="reset"]').hidden = !play
    $('.score').hidden = play
    $('.ctl').hidden = !play
    $('.quiz').hidden = play
    $('.answers').hidden = play

    if (play) {
      drawPool(pool, was)
      $('[data-dir="a"]').setAttribute('aria-pressed', String(pending.zeroForOne))
      $('[data-dir="b"]').setAttribute('aria-pressed', String(!pending.zeroForOne))
      if (slider.valueAsNumber !== pending.amountIn) slider.value = String(pending.amountIn)
      $('.amt b').textContent = String(pending.amountIn)
      $<HTMLButtonElement>('[data-act="swap"]').disabled = t.result.tag === 'Left'
      $<HTMLButtonElement>('[data-act="back"]').disabled = !last
    } else {
      renderQuiz()
    }

    // In a question the code shows plain until the reader asks to be shown.
    const reading = play || showing
    $('.ex').hidden = !reading
    panel.show(listing, reading ? highlight() : undefined)
    if (!reading) return
    $('.dots').innerHTML = t.steps.map((_, i) => `<i class="${i <= step ? 'on' : ''}"></i>`).join('')
    $('.say').textContent = t.steps[step].say
    $<HTMLButtonElement>('[data-act="prev"]').disabled = step === 0
    $<HTMLButtonElement>('[data-act="next"]').disabled = step === t.steps.length - 1
  }

  function renderQuiz() {
    const q = questions[qi]
    const end = showing && step === t.steps.length - 1 && t.result.tag === 'Right'
    if (end && t.result.tag === 'Right') drawPool(t.result.pool, q.pool)
    else drawPool(q.pool)
    $('.score').textContent = `Question ${qi + 1} of ${questions.length}, ${right} of ${answered} right`
    $('.call').innerHTML = renderCall(q.swap, q.pool)
    const answer = showResult(t.result)
    $('.opts').innerHTML = choices(q, qi + 1).map((c) => {
      const cls = picked === undefined ? '' : c === answer ? 'right' : c === picked ? 'wrong' : ''
      const mark = cls === 'right' ? '✓' : cls === 'wrong' ? '✗' : ''
      return `<button class="o ${cls}" data-choice="${escape(c)}"${picked ? ' disabled' : ''}>`
        + `<span>${escape(c)}</span><span>${mark}</span></button>`
    }).join('')
    if (picked === undefined) {
      $('.fb').innerHTML = ''
      return
    }
    const verdict = picked === answer ? 'Right.' : `Not quite: it's ${answer}.`
    $('.fb').innerHTML = `<p><b>${escape(verdict)}</b> ${escape(t.steps[t.steps.length - 1].say)}</p>`
      + '<div class="acts">'
      + (showing ? '' : '<button class="btn p" data-act="show">Show me ▶</button>')
      + `<button class="btn${showing ? ' p' : ''}" data-act="next-question">Next question</button></div>`
  }

  function apply(s: Swap) {
    const r = trace(s, pool).result
    if (r.tag === 'Left') return
    was = pool
    pool = r.pool
    last = { swap: s, amountOut: r.amountOut }
  }

  const actions: Record<string, () => void> = {
    swap() {
      apply(pending)
    },
    back() {
      if (!last) return
      pending = { zeroForOne: !last.swap.zeroForOne, amountIn: last.amountOut }
      apply(pending)
    },
    reset() {
      pool = start
      was = undefined
      last = undefined
    },
    prev() {
      step = Math.max(0, step - 1)
      panel.follow()
    },
    next() {
      step = Math.min(t.steps.length - 1, step + 1)
      panel.follow()
    },
    show() {
      showing = true
      step = 0
      panel.follow()
    },
    'next-question'() {
      qi = (qi + 1) % questions.length
      picked = undefined
      showing = false
    },
  }

  root.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('button')
    // The code panel handles its own buttons.
    if (!b || b.disabled || b.closest('.code')) return
    const { act, mode: m, dir, choice } = b.dataset
    if (m) {
      mode = m as typeof mode
      load(mode === 'predict')
    } else if (dir) {
      pending = { ...pending, zeroForOne: dir === 'a' }
      load(false)
    } else if (choice) {
      picked = choice
      answered++
      if (choice === showResult(t.result)) right++
    } else if (act) {
      actions[act]()
      if (act !== 'prev' && act !== 'next' && act !== 'show') load(mode === 'predict')
    }
    render()
  })

  slider.addEventListener('input', () => {
    pending = { ...pending, amountIn: slider.valueAsNumber }
    load(false)
    render()
  })

  const panel = codePanel($('.code'), 'ConstantSum.hs', [listing], render)
  load(false)
  render()

  return {
    setOptions(o: Options) {
      opts = o
      render()
    },
  }
}

// The call in the question, highlighted like the code.
function renderCall(s: Swap, p: Pool): string {
  const word = (w: string) => /^\(?-?\d/.test(w) ? `<span class="n">${w}</span>`
    : /^[A-Z]/.test(w) ? `<span class="c">${w}</span>` : w
  const parts = (text: string) => text.split(' ').map(word).join(' ')
  return `<span class="n">swap</span> (${parts(showSwap(s))}) (${parts(showPool(p))})`
}

// How much room a bar segment has for its labels.
function size(percent: number): string {
  return percent < 9 ? 'tiny' : percent < 24 ? 'narrow' : 'wide'
}
