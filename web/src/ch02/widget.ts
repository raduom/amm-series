import source from '../../../model/src/AMM/ConstantProduct.hs?raw'
import { type Highlight, escape, foldsIn } from '../code'
import { codePanel } from '../panel'
import { locate } from '../source'
import '../widget.css'
import { drawBar } from './bar'
import { lines } from './lines'
import { type Pool, type Swap, exactOut, num, opposite, showPool, showResult, showSwap, swap } from './model'
import { choices, questions } from './questions'
import { type Trace, trace } from './trace'

export interface Options {
  values: boolean // write values over the names on the highlighted lines
}

const start: Pool = { gold: 100, silver: 100 }
// The sliders' usual ranges. Swapping back can need more, and the range then stays wider until Reset.
const ranges = { amountIn: 200, minAmountOut: 100 }

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
    <div class="bar"><div class="seg a"></div><div class="seg b"></div></div>
    <div class="price"></div>
  </div>
  <div class="ctl stack">
    <label class="amt">amountIn <input data-in="amountIn" type="range" min="0" max="200" step="1"><b></b></label>
    <label class="amt">minAmountOut <input data-in="minAmountOut" type="range" min="0" max="100" step="1"><b></b></label>
    <div class="tg" role="group" aria-label="Which token you pay">
      <button data-dir="a">gold → silver</button><button data-dir="b">silver → gold</button>
    </div>
    <button class="btn p" data-act="swap">Swap</button>
    <button class="btn" data-act="back">Swap back</button>
    <p class="quote" aria-live="polite"></p>
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

export function mountCh02(root: HTMLElement, options: Options) {
  const src = source.split('\n')
  const at = locate(source, lines)
  // The listing stops before poolValue, which the market widget shows with its property.
  const end = src.findIndex((l) => l.startsWith('-- | What the pool holds'))
  const shown = src.slice(0, end)
  const listing = { src: shown, from: at.start, folds: foldsIn(shown, at.start) }
  root.classList.add('amm')
  root.innerHTML = template
  const $ = <T extends HTMLElement>(selector: string) => root.querySelector(selector) as T
  const sliders = [...root.querySelectorAll<HTMLInputElement>('[data-in]')]

  let opts = options
  let mode: 'play' | 'predict' = 'play'
  // Play: the pool, and the swap the controls describe. The code shows that swap.
  let pool = start
  let pending: Swap = { direction: 'GoldForSilver', amountIn: 10, minAmountOut: 0 }
  let last: { swap: Swap; amountOut: number } | undefined
  // The swap just made, and the pool it was made on. Until the controls change, the code shows it.
  let done: { swap: Swap; before: Pool; amountOut: number; paidFirst?: number } | undefined
  let room = { ...ranges }
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
    t = mode === 'predict' ? trace(questions[qi].swap, questions[qi].pool)
      : done ? trace(done.swap, done.before) : trace(pending, pool)
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

  function drawPool(p: Pool) {
    $('.sum').textContent = `gold × silver = ${p.gold * p.silver}`
    drawBar($('.bar'), p)
    $('.price').textContent = p.gold === 0 || p.silver === 0 ? 'a side is empty: no price'
      : p.silver >= p.gold ? `1 gold = ${num(p.silver / p.gold)} silver in the pool`
      : `1 silver = ${num(p.gold / p.silver)} gold in the pool`
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
      drawPool(pool)
      $('[data-dir="a"]').setAttribute('aria-pressed', String(pending.direction === 'GoldForSilver'))
      $('[data-dir="b"]').setAttribute('aria-pressed', String(pending.direction === 'SilverForGold'))
      for (const s of sliders) {
        const key = s.dataset.in as keyof typeof ranges
        const v = pending[key]
        s.max = String(room[key])
        if (s.valueAsNumber !== v) s.value = String(v)
        s.nextElementSibling!.textContent = String(v)
      }
      $<HTMLButtonElement>('[data-act="swap"]').disabled = swap(pending, pool).tag === 'Left'
      $('.quote').innerHTML = done ? report(done) : quote(pending, pool)
      $<HTMLButtonElement>('[data-act="back"]').disabled = !last || swap(reverse(last), pool).tag === 'Left'
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
    if (end && t.result.tag === 'Right') drawPool(t.result.pool)
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

  function apply(s: Swap, paidFirst?: number) {
    const r = swap(s, pool)
    if (r.tag === 'Left') return
    done = { swap: s, before: pool, amountOut: r.amountOut, paidFirst }
    pool = r.pool
    last = { swap: s, amountOut: r.amountOut }
    // The sliders widen to fit what can now be paid in or asked for, and stay wide until Reset.
    room = {
      amountIn: Math.max(room.amountIn, s.amountIn),
      minAmountOut: Math.max(room.minAmountOut, pool.gold, pool.silver),
    }
  }

  const actions: Record<string, () => void> = {
    swap() {
      apply(pending)
    },
    back() {
      if (!last) return
      const paidFirst = last.swap.amountIn
      pending = reverse(last)
      room.amountIn = Math.max(room.amountIn, pending.amountIn)
      apply(pending, paidFirst)
    },
    reset() {
      pool = start
      last = undefined
      done = undefined
      room = { ...ranges }
      pending = { ...pending, amountIn: Math.min(pending.amountIn, ranges.amountIn),
        minAmountOut: Math.min(pending.minAmountOut, ranges.minAmountOut) }
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
      pending = { ...pending, direction: dir === 'a' ? 'GoldForSilver' : 'SilverForGold' }
      done = undefined
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

  for (const s of sliders) {
    s.addEventListener('input', () => {
      pending = { ...pending, [s.dataset.in!]: s.valueAsNumber }
      done = undefined
      load(false)
      render()
    })
  }

  const panel = codePanel($('.code'), 'ConstantProduct.hs', [listing], render)
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

// Swapping back: the other way, paying in what came out, with no minimum.
function reverse(last: { swap: Swap; amountOut: number }): Swap {
  return { direction: opposite(last.swap.direction), amountIn: last.amountOut, minAmountOut: 0 }
}

// What the swap just made did, and for a swap back, what the round trip came to.
function report(d: { swap: Swap; amountOut: number; paidFirst?: number }): string {
  const paid = d.swap.direction === 'GoldForSilver' ? 'gold' : 'silver'
  const got = d.swap.direction === 'GoldForSilver' ? 'silver' : 'gold'
  const swapped = `Swapped: you paid ${d.swap.amountIn} ${paid} and got <b>${d.amountOut} ${got}</b>.`
  if (d.paidFirst === undefined) return swapped
  return `${swapped} Round trip: you got back ${d.amountOut} of the ${d.paidFirst} ${got} you first paid.`
}

// What the swap the controls describe would do, or why it would be refused.
function quote(s: Swap, p: Pool): string {
  const r = swap(s, p)
  const got = s.direction === 'GoldForSilver' ? 'silver' : 'gold'
  if (r.tag === 'Right') return `Pays <b>${r.amountOut} ${got}</b>.`
  if (r.error === 'AmountNotPositive') return '<span class="no">Refused:</span> pay a positive amount.'
  if (r.error === 'EmptyPool') return '<span class="no">Refused:</span> a side of the pool is empty.'
  const out = Math.floor(exactOut(s.direction, s.amountIn, p))
  return out === 0
    ? `<span class="no">Refused:</span> it would pay nothing.`
    : `<span class="no">Refused:</span> it would pay ${out} ${got}, and you asked for at least ${s.minAmountOut}.`
}
