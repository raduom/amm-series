import type { Card } from './cards'
import { escape } from './code'
import './widget.css'

// Flashcards: the cards of a deck come up one at a time, in a shuffled order. A card answered
// right leaves the deck and moves the bar on; a card answered wrong goes to the back and comes
// round again. The deck is done when every card has been answered right. A reload starts over.

const kinds: Record<Card['kind'], string> = {
  define: 'What is it?',
  name: 'Who am I?',
  context: 'At work',
  sort: 'Sort them',
}

const template = `
  <div class="fc-hd">
    <div class="fc-bar" role="progressbar" aria-label="Cards answered right"><i></i></div>
    <span class="fc-count"></span>
  </div>
  <div class="fc-card" aria-live="polite"></div>`

export function mountFlashcards(root: HTMLElement, deck: Card[]) {
  root.classList.add('amm', 'fc')
  root.innerHTML = template
  const $ = <T extends HTMLElement>(selector: string) => root.querySelector(selector) as T

  // The cards still to answer right, by index into the deck, the next one first.
  let queue: number[] = []
  let right = 0
  let misses = 0
  // The card being answered.
  let choices: string[] = []
  let picked: string | undefined
  let typed = ''
  let placed = new Map<number, number>() // sort: term → group
  let selected: number | undefined       // sort: the term picked up
  let answered: boolean | undefined      // undefined while asking, then right or wrong

  function start() {
    queue = shuffle(deck.map((_, i) => i))
    right = 0
    misses = 0
    deal()
  }

  function deal() {
    const card = deck[queue[0]]
    choices = card === undefined ? []
      : card.kind === 'define' ? shuffle([card.answer, ...card.wrong])
      : card.kind === 'context' && card.wrong ? shuffle([card.answer, ...card.wrong])
      : []
    picked = undefined
    typed = ''
    placed = new Map()
    selected = undefined
    answered = undefined
  }

  function check() {
    const card = deck[queue[0]]
    if (card.kind === 'sort') answered = card.items.every((item, i) => placed.get(i) === item.group)
    else if (choices.length > 0) answered = picked === card.answer
    else answered = [card.answer, ...('aliases' in card ? card.aliases ?? [] : [])].some((a) => same(a, typed))
    if (!answered) misses++
  }

  function next() {
    const card = queue.shift()!
    if (answered) right++
    else queue.push(card)
    deal()
  }

  function render() {
    $<HTMLElement>('.fc-bar i').style.width = `${(100 * right) / deck.length}%`
    $('.fc-bar').setAttribute('aria-valuenow', String(right))
    $('.fc-bar').setAttribute('aria-valuemax', String(deck.length))
    $('.fc-count').textContent = `${right} / ${deck.length}`
    const box = $('.fc-card')
    if (queue.length === 0) {
      box.innerHTML = `<p class="fc-done">All ${deck.length} cards answered right`
        + (misses === 0 ? ', with no misses.' : `, after ${misses} ${misses === 1 ? 'miss' : 'misses'} along the way.`)
        + '</p><div class="acts"><button class="btn p" data-act="again">Start again</button></div>'
      return
    }
    const card = deck[queue[0]]
    box.innerHTML = `<p class="fc-kind">${kinds[card.kind]}</p>${ask(card)}${answer(card)}${feedback(card)}`
    const input = box.querySelector<HTMLInputElement>('input')
    if (input && answered === undefined) {
      input.value = typed
      input.focus()
    } else box.querySelector<HTMLElement>('[data-act="next"]')?.focus()
  }

  function ask(card: Card): string {
    switch (card.kind) {
      case 'define': return `<p class="fc-q">What is <code>${escape(card.term)}</code>?</p>`
      case 'name': return `<p class="fc-q">${text(card.clue)}</p>`
      case 'context': return (card.setup ? `<pre class="fc-setup">${escape(card.setup)}</pre>` : '')
        + `<p class="fc-q">${text(card.question)}</p>`
      case 'sort': return `<p class="fc-q">${text(card.question)}</p>`
    }
  }

  function answer(card: Card): string {
    if (card.kind === 'sort') return sorting(card)
    if (choices.length > 0) {
      return '<div class="opts fc-opts">' + choices.map((c) => {
        const cls = answered === undefined ? '' : c === card.answer ? 'right' : c === picked ? 'wrong' : ''
        return `<button class="o ${cls}" data-choice="${escape(c)}"${answered === undefined ? '' : ' disabled'}>`
          + `<span>${text(c)}</span></button>`
      }).join('') + '</div>'
    }
    const cls = answered === undefined ? '' : answered ? ' right' : ' wrong'
    return `<div class="fc-type"><input class="fc-in${cls}" type="text" autocomplete="off" autocapitalize="off" `
      + `spellcheck="false" aria-label="Your answer"${answered === undefined ? '' : ' disabled'}>`
      + (answered === undefined
        ? '<button class="btn p" data-act="check">Check</button><button class="btn" data-act="give-up">Show me</button>'
        : '') + '</div>'
  }

  // The terms still to place, then a box for each group with the terms placed in it. A term is
  // picked up by tapping it and put down by tapping a group; with a mouse it can be dragged.
  function sorting(card: Extract<Card, { kind: 'sort' }>): string {
    const chip = (i: number) => {
      const item = card.items[i]
      const mark = answered === undefined ? (selected === i ? ' on' : '')
        : placed.get(i) === item.group ? ' right' : ' wrong'
      return `<button class="fc-chip${mark}" data-item="${i}" draggable="${answered === undefined}"`
        + `${answered === undefined ? '' : ' disabled'}>${text(item.term)}</button>`
    }
    const loose = card.items.map((_, i) => i).filter((i) => !placed.has(i))
    const tray = answered === undefined
      ? `<div class="fc-tray" data-group="-1">${loose.length ? loose.map(chip).join('') : '<span class="m">all placed</span>'}</div>`
      : ''
    const groups = card.groups.map((g, gi) => {
      const here = card.items.map((_, i) => i).filter((i) => placed.get(i) === gi)
      return `<div class="fc-group" data-group="${gi}"><p>${text(g)}</p><div>${here.map(chip).join('')}</div></div>`
    }).join('')
    return `${tray}<div class="fc-groups" style="--n: ${card.groups.length}">${groups}</div>`
      + (answered === undefined
        ? `<div class="acts"><button class="btn p" data-act="check"${loose.length ? ' disabled' : ''}>Check</button></div>`
        : '')
  }

  function feedback(card: Card): string {
    if (answered === undefined) return ''
    const solution = card.kind === 'sort'
      ? card.groups.map((g, gi) => `${text(g)}: ${card.items.filter((it) => it.group === gi).map((it) => text(it.term)).join(', ')}`)
        .join('<br>')
      : card.kind === 'name' || (card.kind === 'context' && choices.length === 0) ? `It's <code>${escape(card.answer)}</code>.`
      : ''
    return `<div class="fc-fb ${answered ? 'right' : 'wrong'}"><p><b>${answered ? 'Right.' : 'Not quite.'}</b> `
      + `${answered || !solution ? '' : `${solution} `}${text(card.explain)}</p>`
      + `<p class="fc-later">${answered ? '' : 'This card goes to the back and comes round again.'}</p>`
      + '<div class="acts"><button class="btn p" data-act="next">Next card</button></div></div>'
  }

  function place(item: number, group: number) {
    if (group < 0) placed.delete(item)
    else placed.set(item, group)
    selected = undefined
  }

  root.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    const b = target.closest('button')
    if (b?.disabled) return
    if (b?.dataset.item !== undefined && answered === undefined) {
      const i = Number(b.dataset.item)
      selected = selected === i ? undefined : i
    } else if (b?.dataset.choice !== undefined && answered === undefined) {
      picked = b.dataset.choice
      check()
    } else if (b?.dataset.act === 'check') {
      typed = root.querySelector<HTMLInputElement>('.fc-in')?.value ?? typed
      check()
    } else if (b?.dataset.act === 'give-up') {
      typed = ''
      answered = false
      misses++
    } else if (b?.dataset.act === 'next') next()
    else if (b?.dataset.act === 'again') start()
    else {
      // Tapping a group, or the tray, puts the picked-up term there.
      const g = target.closest<HTMLElement>('[data-group]')
      if (!g || selected === undefined || answered !== undefined) return
      place(selected, Number(g.dataset.group))
    }
    render()
  })

  root.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || !(e.target instanceof HTMLInputElement) || answered !== undefined) return
    typed = e.target.value
    if (typed.trim() === '') return
    check()
    render()
  })

  root.addEventListener('dragstart', (e) => {
    const chip = (e.target as HTMLElement).closest<HTMLElement>('[data-item]')
    if (chip) e.dataTransfer?.setData('text/plain', chip.dataset.item!)
  })
  root.addEventListener('dragover', (e) => {
    if ((e.target as HTMLElement).closest('[data-group]')) e.preventDefault()
  })
  root.addEventListener('drop', (e) => {
    const g = (e.target as HTMLElement).closest<HTMLElement>('[data-group]')
    const item = e.dataTransfer?.getData('text/plain')
    if (!g || item === undefined || item === '' || answered !== undefined) return
    e.preventDefault()
    place(Number(item), Number(g.dataset.group))
    render()
  })

  start()
  render()
  return { setOptions() {} }
}

// Text with code between backticks, as HTML.
function text(s: string): string {
  return escape(s).replace(/`([^`]+)`/g, '<code>$1</code>')
}

// Typed answers match ignoring case, a leading "the", spaces, backticks, underscores and
// apostrophes, with * and · read as ×.
function same(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().trim().replace(/^the\s+/, '')
    .replace(/[\s`_'’]/g, '').replace(/[*·]/g, '×')
  return norm(a) === norm(b)
}

function shuffle<T>(items: T[]): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
