---
name: flashcards
description: Write a flashcard deck for a chapter's interactive page, so readers learn what the model's names and ideas mean (reserveIn, amountOut, k, …). Use when asked to make, extend or check flashcards for a chapter.
---

# Writing a flashcard deck

A deck teaches the names a chapter's model uses and the ideas behind them. The reader answers
cards until every card has been answered right; a wrong card goes to the back of the queue and
comes round again. The widget is `web/src/flashcards.ts`; the card types are in
`web/src/cards.ts`. A deck is one file, `web/src/chNN/cards.ts`, exporting `deck: Card[]`.

## What to cover

- Take the terms from the chapter's model (`model/src/AMM/*.hs`): the names in its main
  function (inputs, `where` bindings, results), its error constructors, and the ideas the
  chapter introduces (an invariant, a price, a rounding rule). Ten to twenty terms.
- No Haskell terms (guard, `where`, `Left`/`Right`, `div` as syntax). The deck is about the
  market maker, not the language. A Haskell name of the model (`reserveIn`) is fine; the idea
  it stands for is what is tested.
- Use the series' names, exactly as the model spells them: `gold`/`silver`, `GoldForSilver`/
  `SilverForGold`, `amountIn`, … Never `token0`/`token1` or `zeroForOne` in a model deck.

## How many, and which kinds

About 15 cards, weighted toward the harder kinds, roughly:

| Kind | Cards | What it tests |
|---|---|---|
| `sort` | 5 | Put several terms into two or three groups by one criterion |
| `context` | 5 | The term at work: its value in a given call, or what happens, pick 1 of 4 |
| `name` | 4 | Meaning → term: "Who am I?", pick 1 of 4 |
| `define` | 1–2 | Term → meaning: "What is `reserveOut`?", pick 1 of 4 |

- **Cover every main term at least once.** Fifteen cards can't give each term a card of its
  own, so let `sort` cards carry several terms each, and spend `name` and `define` cards on the
  ideas a reader most often confuses. Don't give one term both a `define` and a `name` card.
- **Every card is answered by clicking or moving**, never by typing: `define`, `name` and
  `context` cards are 1 of 4, `sort` cards are moved into groups.
- **Wrong answers are real confusions.** For `define`, take the wrong definitions from the
  terms a reader mixes up: `reserveIn` against `reserveOut`, `amountOut` against
  `minAmountOut`, the price before against the price after. For `name`, the wrong keywords are
  the terms the clue could be mistaken for (`price impact` against `rounding down`, one error
  constructor against another). Make all four answers about the same length and in the same
  style, so the right one doesn't stand out.
- **`name` clues are written as "I am …"**, describe one term only, and don't contain the
  keyword or an obvious part of it, and don't repeat the wording of the term's `define` card.
  Write the keyword between backticks when it is a name in the code (`` `EmptyPool` ``), and as
  plain words when it is an idea (`rounding down`).
- **`context` cards use small numbers a reader can work out in their head**, from a pool and
  a call written as the model writes them: `swap (Swap SilverForGold 30 0) (Pool 100 60)`.
  Ask for one thing: a value (`reserveIn` is 60), a result, an error. Take each wrong answer
  from a slip in working it out: one for one as in chapter 1, the price before the swap, no
  rounding, rounding up.
- **`sort` cards use one criterion each**, stated as a question, with two or three groups and
  three to six terms, each short enough for a chip on a phone (about 30 characters). Good
  criteria: who decides it (the trader, the pool, `swap` works it
  out); does it change during a swap; in a `GoldForSilver` swap, is it gold or silver; input or
  result; which guard refuses. Every term must belong to exactly one group under the
  criterion, with no arguing.
- **Every card has an `explain`**: one to three short sentences shown after the answer, saying
  why, with the numbers worked out for a `context` card. It is what the reader learns from a
  miss.

## Writing

- Plain words, short sentences, the series' voice: no jargon the chapter hasn't introduced.
- Code between backticks: `reserveOut`, `Pool 100 60`. The widget shows it in the code font.
- Check every card against the model's code, and work every number out. A deck with one wrong
  card teaches the wrong thing; if in doubt, run the model (`cabal repl` in `model/`).
- Mind the rounding. Claims that hold for the exact formula can fail after rounding to whole
  units: larger trades get worse prices only up to rounding, and a pool priced off the market
  doesn't always leave a profitable whole-unit trade. Write exact fractions (`100/11`), not
  rounded decimals presented as equal.
- Have the deck checked by a second reader against the model before it ships.
- Don't repeat a card with new numbers. Fifteen cards should feel like fifteen questions.

## Putting a deck on a page

```ts
import { deck } from './ch02/cards'
import { mountFlashcards } from './flashcards'
mountFlashcards(element, deck)
```

In `web/src/main.ts`, mount it like the other widgets, into an element of the chapter's
article in `web/index.html`. Then run `npm run build` in `web/` and try the deck through to the
end in the browser.
