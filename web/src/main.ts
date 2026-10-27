import { mountCh01Properties } from './ch01/propertyWidget'
import { mountCh01 } from './ch01/widget'
import { deck as ch02Deck } from './ch02/cards'
import { mountCh02Curve } from './ch02/curve'
import { mountCh02Market } from './ch02/market'
import { mountCh02Properties } from './ch02/propertyWidget'
import { mountCh02 } from './ch02/widget'
import { mountFlashcards } from './flashcards'
import './page.css'

// Settings for trying the page out. They live in the query string, so a view can be linked.
const settings = {
  chapter: { label: 'Chapter', options: ['2', '1'] },
  theme: { label: 'Theme', options: ['light', 'dark'] },
  code: { label: 'Highlighted lines show', options: ['values', 'names'] },
  width: { label: 'Column', options: ['720', '342'] },
} as const
type Setting = keyof typeof settings

const query = new URLSearchParams(location.search)
const prefersDark = matchMedia('(prefers-color-scheme: dark)').matches
const chosen = Object.fromEntries(Object.entries(settings).map(([key, { options }]) => {
  const fallback = key === 'theme' && prefersDark ? 'dark' : options[0]
  const value = query.get(key)
  return [key, value && (options as readonly string[]).includes(value) ? value : fallback]
})) as Record<Setting, string>

const bar = document.querySelector<HTMLElement>('.try')!
const articles = [...document.querySelectorAll<HTMLElement>('.article')]

const widgets = [
  mount('#page', mountCh01),
  mount('#properties', mountCh01Properties),
  mount('#ch02-swap', mountCh02),
  mount('#ch02-cards', (el) => mountFlashcards(el, ch02Deck)),
  mount('#ch02-curve', mountCh02Curve),
  mount('#ch02-properties', mountCh02Properties),
  mount('#ch02-market', mountCh02Market),
]

type Mount = (el: HTMLElement, options: { values: boolean }) => { setOptions(o: { values: boolean }): void }

function mount(selector: string, how: Mount) {
  const el = document.querySelector<HTMLElement>(selector)!
  try {
    return how(el, options())
  } catch (e) {
    el.textContent = String(e)
  }
}

bar.innerHTML = (Object.keys(settings) as Setting[]).map((key) =>
  `<span>${settings[key].label}: ${settings[key].options.map((o) =>
    `<button data-key="${key}" data-value="${o}">${o === '342' ? 'phone' : o}</button>`).join('')}</span>`).join('')

bar.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest('button')
  if (!b) return
  chosen[b.dataset.key as Setting] = b.dataset.value!
  apply()
})

function options() {
  return { values: chosen.code === 'values' }
}

function apply() {
  document.documentElement.classList.toggle('dark', chosen.theme === 'dark')
  for (const a of articles) {
    a.hidden = a.dataset.chapter !== chosen.chapter
    a.style.maxWidth = `${chosen.width}px`
  }
  for (const b of bar.querySelectorAll<HTMLElement>('button')) {
    b.setAttribute('aria-pressed', String(chosen[b.dataset.key as Setting] === b.dataset.value))
  }
  for (const w of widgets) w?.setOptions(options())
  history.replaceState(null, '', `?${new URLSearchParams(chosen)}`)
}

apply()
