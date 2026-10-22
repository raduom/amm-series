import { type Fold, type Highlight, escape, renderCode } from './code'

// Code the panel can show: a source from a line on, with the declarations that fold.
export interface Listing {
  src: string[]
  from: number
  folds: Fold[]
}

// A widget's code: a header with the file's name and Fold all, and the code under it.
// It keeps one height, a row taller than the tallest listing with everything folded,
// so the controls under it stay put. Unfolded declarations scroll. Lines wrap, so
// it's measured, and measured again when the width changes. When notes on highlighted
// lines take more rows, the widget passes samples of them to measure too.
export function codePanel(
  code: HTMLElement, file: string, listings: Listing[], changed: () => void,
  samples: () => { listing: Listing; hl: Highlight }[] = () => [],
) {
  code.innerHTML = `<div class="ch"><span>${escape(file)}</span><button class="mini" data-folds></button></div>`
    + '<div class="src"></div>'
  const src = code.querySelector<HTMLElement>('.src')!
  const all = code.querySelector<HTMLElement>('[data-folds]')!
  // Declarations the reader unfolded. They start folded.
  const open = new Set<number>()
  let shown = listings[0]
  // Scroll the highlighted lines into view at the next show.
  let follow = true

  function fit() {
    src.style.height = ''
    let tallest = 0
    const measure = (l: Listing, hl?: Highlight) => {
      src.innerHTML = renderCode(l.src, { from: l.from, folds: l.folds, open: new Set() }, hl)
      tallest = Math.max(tallest, src.scrollHeight)
    }
    for (const l of listings) measure(l)
    for (const { listing, hl } of samples()) measure(listing, hl)
    if (tallest > 0) src.style.height = `calc(${tallest}px + 1.6em)`
  }

  // Without a highlight the code shows plain.
  function show(l: Listing, hl?: Highlight) {
    shown = l
    all.textContent = l.folds.every((f) => open.has(f.at)) ? 'Fold all' : 'Unfold all'
    all.hidden = l.folds.length === 0
    src.innerHTML = renderCode(l.src, { from: l.from, folds: l.folds, open }, hl)
    if (follow) reveal()
    follow = false
  }

  // Scroll the code, and only the code, so the highlighted lines are in view.
  function reveal() {
    const lines = src.querySelectorAll<HTMLElement>('.l.f')
    if (lines.length === 0) return
    const first = lines[0]
    const last = lines[lines.length - 1]
    const margin = parseFloat(getComputedStyle(src).lineHeight)
    const bottom = last.offsetTop + last.offsetHeight + margin
    if (bottom > src.scrollTop + src.clientHeight) src.scrollTop = bottom - src.clientHeight
    if (first.offsetTop - margin < src.scrollTop) src.scrollTop = first.offsetTop - margin
  }

  code.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('button')
    if (!b) return
    if (b.dataset.folds !== undefined) {
      if (shown.folds.every((f) => open.has(f.at))) open.clear()
      else for (const f of shown.folds) open.add(f.at)
    } else if (b.dataset.fold) {
      const n = Number(b.dataset.fold)
      if (!open.delete(n)) open.add(n)
    } else {
      return
    }
    changed()
  })

  fit()
  let width = 0
  new ResizeObserver(() => {
    if (code.clientWidth === width) return
    width = code.clientWidth
    fit()
    follow = true
    changed()
  }).observe(code)

  return {
    show,
    fit,
    follow() {
      follow = true
    },
  }
}
