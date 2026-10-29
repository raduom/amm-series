// The cards a flashcard deck is made of. A deck is a plain list of them; the widget in
// flashcards.ts deals them out. How to write a deck: .agents/skills/flashcards/SKILL.md.

// Code is written between backticks in prompts and answers, and shows in the code font.
export type Card = DefineCard | NameCard | ContextCard | SortCard

// "What is `reserveOut`?": pick the definition.
export interface DefineCard {
  kind: 'define'
  term: string     // the keyword, shown as code
  answer: string   // its definition
  wrong: string[]  // three definitions it is easily mistaken for
  explain: string  // shown after answering, right or wrong
}

// "Who am I?": read the definition, pick the keyword.
export interface NameCard {
  kind: 'name'
  clue: string     // the definition, written as "I am …"
  answer: string   // the keyword
  wrong: string[]  // three keywords it is easily mistaken for
  explain: string
}

// The term at work in a call or a pool: pick its value, or what happens.
export interface ContextCard {
  kind: 'context'
  setup?: string   // a line of code or a pool, shown as code above the question
  question: string
  answer: string
  wrong: string[]  // three answers a slip in working it out would give
  explain: string
}

// Put each term in its group.
export interface SortCard {
  kind: 'sort'
  question: string                           // the criterion, e.g. "Who decides it?"
  groups: string[]                           // two or three
  items: { term: string; group: number }[]   // three to six terms, by index into groups
  explain: string
}
