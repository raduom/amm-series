import '../widget.css'
import { type Pool, cut, exactOut, num, swap } from './model'

// Price impact: what a trade of each size gets from a pool, drawn two ways. Left, the pool's
// curve gold × silver = k with the trade as a step along it, next to chapter 1's straight line.
// Right, the price the trade gets against its size, before and after rounding.

const sizes = { small: 100, large: 10_000 } as const
type Size = keyof typeof sizes

const template = `
  <div class="hd">
    <div class="tg" role="group" aria-label="Pool size">
      <button data-size="small">Pool of 100 + 100</button><button data-size="large">10 000 + 10 000</button>
    </div>
  </div>
  <div class="ctl">
    <label class="amt">gold paid <input type="range" min="1" step="1"><b></b></label>
  </div>
  <div class="facts"></div>
  <div class="charts">
    <figure><figcaption>The pool's curve <span class="key"><span><i class="k-series"></i>gold × silver = k</span>`
    + `<span><i class="k-ref"></i>gold + silver, chapter 1</span></span></figcaption><svg class="curve" role="img"></svg></figure>
    <figure><figcaption>Silver you get per gold you pay <span class="key"><span><i class="k-series"></i>before rounding</span>`
    + `<span><i class="k-rounded"></i>after rounding</span><span><i class="k-ref"></i>pool price before</span></span></figcaption>`
    + `<svg class="impact pick" role="img"></svg><p class="hint"></p></figure>
  </div>`

export function mountCh02Curve(root: HTMLElement) {
  root.classList.add('amm')
  root.innerHTML = template
  const $ = <T extends Element>(selector: string) => root.querySelector(selector) as T
  const slider = $<HTMLInputElement>('.amt input')

  let size: Size = 'small'
  let amountIn = 50

  const reserve = () => sizes[size]
  const maxIn = () => 3 * reserve()

  function render() {
    const R = reserve()
    const pool: Pool = { gold: R, silver: R }
    for (const b of root.querySelectorAll<HTMLElement>('[data-size]')) {
      b.setAttribute('aria-pressed', String(b.dataset.size === size))
    }
    // Every value the slider can take is a whole number of steps, from one step up.
    slider.min = String(R / 100)
    slider.max = String(maxIn())
    slider.step = String(R / 100)
    if (slider.valueAsNumber !== amountIn) slider.value = String(amountIn)
    $('.amt b').textContent = String(amountIn)

    const exact = exactOut('GoldForSilver', amountIn, pool)
    const r = swap({ direction: 'GoldForSilver', amountIn, minAmountOut: 0 }, pool)
    const out = r.tag === 'Right' ? r.amountOut : 0
    const after = r.tag === 'Right' ? r.pool : pool
    const got = out / amountIn
    $('.facts').innerHTML = r.tag === 'Left' ? [
      fact('you get', 'nothing', `${cut(exact)}… silver, rounded down to 0: the swap is refused with OutputTooSmall`),
    ].join('') : [
      fact('you get', `${out} silver`, Number.isInteger(exact) ? '' : `${cut(exact)}… before rounding`),
      fact('your price', `${num(got)}`, got >= after.silver / after.gold
        ? 'silver per gold: between the pool price before and after'
        : 'silver per gold: below even the pool price after, as rounding took most of a silver from a small trade'),
      fact('pool price', `1 → ${num(after.silver / after.gold)}`, 'silver per gold, before → after'),
      fact('price impact', `${Math.round(100 * (1 - got))}%`, 'worse than the pool price before'),
    ].join('')

    drawCurve($('.curve'), pool, r.tag === 'Right' ? after : undefined)
    drawImpact($('.impact'), pool, amountIn, maxIn())
    $('.hint').textContent = 'Rounding takes less than one silver from every trade, so it costs less than '
      + '1 ÷ (gold paid) per gold: a large share of a small trade, next to nothing of a large one. '
      + 'Press or drag on the chart to pick a trade.'
  }

  root.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-size]')
    if (!b) return
    const was = reserve()
    size = b.dataset.size as Size
    // The same share of the pool, in whole steps.
    const step = reserve() / 100
    amountIn = Math.max(1, Math.round(((amountIn / was) * reserve()) / step)) * step
    render()
  })

  slider.addEventListener('input', () => {
    amountIn = slider.valueAsNumber
    render()
  })

  // Pressing on the price chart, or dragging along it, picks the trade size there.
  const impact = $<SVGSVGElement>('.impact')
  const pick = (e: Event) => {
    if (!(e instanceof PointerEvent)) return
    if (e.type === 'pointermove' && e.buttons === 0) return
    const svg = impact
    const box = svg.getBoundingClientRect()
    const x = (e.clientX - box.left - pad.left) / (box.width - pad.left - pad.right)
    if (x < 0 || x > 1) return
    const step = reserve() / 100
    amountIn = Math.max(1, Math.round((x * maxIn()) / step)) * step
    render()
  }
  impact.addEventListener('pointerdown', pick)
  impact.addEventListener('pointermove', pick)

  new ResizeObserver(render).observe(root)
  render()
  return { setOptions() {} }
}

function fact(label: string, value: string, note: string): string {
  return `<div class="fact"><span>${label}</span><b>${value}</b><small>${note}</small></div>`
}

// Chart geometry, in pixels.
const height = 230
const pad = { left: 44, right: 14, top: 26, bottom: 34 }

interface Frame {
  x: (v: number) => number
  y: (v: number) => number
  width: number
}

function frame(svg: SVGSVGElement, xMax: number, yMax: number): Frame {
  const width = Math.max(200, svg.clientWidth || 300)
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
  svg.setAttribute('height', String(height))
  const w = width - pad.left - pad.right
  const h = height - pad.top - pad.bottom
  return {
    x: (v) => pad.left + (v / xMax) * w,
    y: (v) => pad.top + h - (v / yMax) * h,
    width,
  }
}

function axes(f: Frame, xMax: number, xLabel: string, yLabel: string, xTicks: number[], yTicks: number[]) {
  const x0 = f.x(0)
  const y0 = f.y(0)
  const grid = yTicks.map((v) =>
    `<line class="grid" x1="${x0}" x2="${f.x(xMax)}" y1="${f.y(v)}" y2="${f.y(v)}"/>`
    + `<text class="tick" x="${x0 - 6}" y="${f.y(v) + 4}" text-anchor="end">${short(v)}</text>`).join('')
  const xt = xTicks.map((v) =>
    `<text class="tick" x="${f.x(v)}" y="${y0 + 16}" text-anchor="middle">${short(v)}</text>`).join('')
  return grid + xt
    + `<line class="axis" x1="${x0}" x2="${f.x(xMax)}" y1="${y0}" y2="${y0}"/>`
    + `<text class="lbl" x="${f.x(xMax)}" y="${y0 + 30}" text-anchor="end">${xLabel}</text>`
    + `<text class="lbl" x="4" y="12">${yLabel}</text>`
}

// The pool's curve, chapter 1's line, and the trade as a step from one point to the other.
// A refused trade has no after: only the pool before is drawn.
function drawCurve(svg: SVGSVGElement, before: Pool, after?: Pool) {
  const R = before.gold
  const k = before.gold * before.silver
  const xMax = 4 * R
  const yMax = 2.2 * R
  const f = frame(svg, xMax, yMax)
  const path = Array.from({ length: 120 }, (_, i) => {
    const x = k / yMax + ((xMax - k / yMax) * i) / 119
    return `${i === 0 ? 'M' : 'L'}${f.x(x).toFixed(1)},${f.y(k / x).toFixed(1)}`
  }).join('')
  const sumEnd = Math.min(2 * R, xMax)
  const p0 = { x: f.x(before.gold), y: f.y(before.silver) }
  svg.setAttribute('aria-label', `The curve gold times silver equals ${k}. `
    + (after ? `The trade moves the pool from ${before.gold} gold and ${before.silver} silver to `
      + `${after.gold} gold and ${after.silver} silver.` : `The trade is refused, so the pool stays where it is.`))
  const base = axes(f, xMax, 'gold', 'silver', [0, R, 2 * R, 3 * R], [0, R / 2, R, 1.5 * R, 2 * R])
    + `<line class="ref" x1="${f.x(0)}" y1="${f.y(2 * R)}" x2="${f.x(sumEnd)}" y2="${f.y(2 * R - sumEnd)}"/>`
    + `<path class="series" d="${path}"/>`
  if (!after) {
    svg.innerHTML = base + `<circle class="dot before" cx="${p0.x}" cy="${p0.y}" r="5"/>`
    return
  }
  const p1 = { x: f.x(after.gold), y: f.y(after.silver) }
  svg.innerHTML = base
    + `<path class="trade" d="M${p0.x},${p0.y}H${p1.x}V${p1.y}"/>`
    + `<text class="trade-lbl" x="${Math.max((p0.x + p1.x) / 2, p0.x + 34)}" y="${p0.y - 10}" text-anchor="middle">+${short(after.gold - before.gold)} gold</text>`
    // Near the right edge the silver label goes on the left of the step.
    + (p1.x > f.width - 90
      ? `<text class="trade-lbl" x="${p1.x - 6}" y="${(p0.y + p1.y) / 2 + 4}" text-anchor="end">−${short(before.silver - after.silver)} silver</text>`
      : `<text class="trade-lbl" x="${p1.x + 6}" y="${(p0.y + p1.y) / 2 + 4}">−${short(before.silver - after.silver)} silver</text>`)
    + `<circle class="dot before" cx="${p0.x}" cy="${p0.y}" r="5"/>`
    + `<circle class="dot" cx="${p1.x}" cy="${p1.y}" r="5"/>`
}

// The price a trade gets against its size: the exact curve, the rounded one, the pool price
// before the trade, and the trade picked now.
function drawImpact(svg: SVGSVGElement, pool: Pool, amountIn: number, maxIn: number) {
  const yMax = 1.1
  const f = frame(svg, maxIn, yMax)
  const n = Math.min(maxIn, 600)
  const xs = Array.from({ length: n }, (_, i) => Math.max(1, Math.round(((i + 1) * maxIn) / n)))
  const exact = (a: number) => exactOut('GoldForSilver', a, pool) / a
  const rounded = (a: number) => Math.floor(exactOut('GoldForSilver', a, pool)) / a
  const line = (price: (a: number) => number, from = 1) =>
    xs.filter((a) => a >= from)
      .map((a, i) => `${i === 0 ? 'M' : 'L'}${f.x(a).toFixed(1)},${f.y(price(a)).toFixed(1)}`).join('')
  // Trades too small to get a whole unit out are refused, so the rounded line starts after them.
  const first = xs.find((a) => rounded(a) > 0) ?? maxIn
  const cx = f.x(amountIn)
  const cy = f.y(rounded(amountIn))
  svg.setAttribute('aria-label', `Paying ${amountIn} gold gets ${num(rounded(amountIn))} silver per gold, `
    + `against a pool price of 1 before the trade.`)
  svg.innerHTML = axes(f, maxIn, 'gold paid', 'silver per gold', [0, maxIn / 3, (2 * maxIn) / 3, maxIn], [0, 0.25, 0.5, 0.75, 1])
    + `<line class="ref" x1="${f.x(0)}" x2="${f.x(maxIn)}" y1="${f.y(1)}" y2="${f.y(1)}"/>`
    + `<path class="series" d="${line(exact)}"/>`
    + `<path class="rounded" d="${line(rounded, first)}"/>`
    + `<line class="cross" x1="${cx}" x2="${cx}" y1="${f.y(0)}" y2="${f.y(yMax)}"/>`
    + `<circle class="dot" cx="${cx}" cy="${cy}" r="5"/>`
}

const short = (v: number) => (v >= 1000 && v % 100 === 0 ? `${v / 1000}k` : Number.isInteger(v) ? `${v}` : v.toFixed(2))
