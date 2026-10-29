import type { Card } from '../cards'

// Chapter 2's deck: the names in the constant-product model and the ideas behind them, fifteen
// cards weighted toward the harder kinds (working a swap out, sorting, naming the idea).
export const deck: Card[] = [
  {
    kind: 'sort',
    question: 'In a `SilverForGold` swap, is it gold or silver?',
    groups: ['gold', 'silver'],
    items: [
      { term: 'amountIn', group: 1 },
      { term: 'amountOut', group: 0 },
      { term: 'reserveIn', group: 1 },
      { term: 'reserveOut', group: 0 },
      { term: 'minAmountOut', group: 0 },
    ],
    explain: 'A `SilverForGold` swap pays silver in and takes gold out. So `amountIn` and `reserveIn` are silver; '
      + '`amountOut`, `reserveOut` and `minAmountOut` are gold.',
  },
  {
    kind: 'context',
    setup: 'swap (Swap GoldForSilver 20 0) (Pool 60 90)',
    question: 'What is `amountOut`?',
    answer: '22',
    wrong: ['20', '22.5', '30'],
    explain: '`90 * 20 / (60 + 20)` is 1800/80, or 45/2, rounded down to 22. The pool keeps the half and ends at '
      + '`Pool 80 68`.',
  },
  {
    kind: 'sort',
    question: 'Who decides it?',
    groups: ['the trader', '`swap` works it out'],
    items: [
      { term: 'amountIn', group: 0 },
      { term: 'minAmountOut', group: 0 },
      { term: 'direction', group: 0 },
      { term: 'amountOut', group: 1 },
      { term: 'reserveIn', group: 1 },
      { term: 'reserveOut', group: 1 },
    ],
    explain: 'The trader writes the `Swap`: `direction`, `amountIn` and `minAmountOut`. `swap` picks `reserveIn` and '
      + '`reserveOut` from the pool by `direction`, then works out `amountOut`.',
  },
  {
    kind: 'context',
    setup: 'swap (Swap GoldForSilver 20 18) (Pool 100 100)',
    question: 'What happens?',
    answer: 'It is refused with `OutputTooSmall`; nothing is paid',
    wrong: [
      'It pays 16 silver and the pool keeps the fraction',
      'It pays 18 silver, the minimum the trader asked for',
      'It pays 20 silver, one for one as in chapter 1',
    ],
    explain: '`amountOut` is `100 * 20 / 120`, which is 50/3, rounded down to 16. That is below `minAmountOut`, 18, '
      + 'so `swap` refuses and the pool stays as it was.',
  },
  {
    kind: 'context',
    setup: 'swap (Swap GoldForSilver 10 0) (Pool 100 100)',
    question: '`k` is 10000 before the swap. What is it after?',
    answer: '10010',
    wrong: ['10000', '9900', '11000'],
    explain: '`amountOut` is `100 * 10 / 110`, exactly 100/11, rounded down to 9. The pool becomes `Pool 110 91`, '
      + 'and 110 × 91 = 10010. The pool kept 1/11 of a silver, and 110 × 1/11 = 10 is what `k` gained.',
  },
  {
    kind: 'sort',
    question: 'Each chip is a `GoldForSilver` swap: the gold paid in and the pool, with `minAmountOut` 0 unless '
      + 'shown. Which error refuses it?',
    groups: ['`AmountNotPositive`', '`EmptyPool`', '`OutputTooSmall`'],
    items: [
      { term: 'pay -5 into `Pool 100 100`', group: 0 },
      { term: 'pay 0 into `Pool 0 100`', group: 0 },
      { term: 'pay 10 into `Pool 0 100`', group: 1 },
      { term: 'pay 10 into `Pool 100 0`', group: 1 },
      { term: 'pay 2 into `Pool 100 40`', group: 2 },
      { term: 'pay 50 into `Pool 100 100`, min 40', group: 2 },
    ],
    explain: 'The checks run in order: `amountIn` first, then the reserves, then the payout. So paying 0 into an '
      + 'empty pool is `AmountNotPositive`. `40 * 2 / 102` rounds down to 0, and `100 * 50 / 150` to 33, below 40.',
  },
  {
    kind: 'define',
    term: 'silver / gold',
    answer: 'The pool\'s price: how much silver one gold is worth in the pool',
    wrong: [
      'The market price: what one gold is worth outside the pool',
      'What a trader gets for each gold, in a swap of any size',
      'How much gold one silver is worth in the pool',
    ],
    explain: 'The pool\'s price is `silver / gold`, read off the reserves. It moves with every swap, and a trader '
      + 'selling gold always gets fewer silver per gold than it.',
  },
  {
    kind: 'sort',
    question: 'In a `GoldForSilver` swap, does it go up or down?',
    groups: ['up', 'down'],
    items: [
      { term: 'gold', group: 0 },
      { term: 'silver', group: 1 },
      { term: '`silver / gold`, the pool\'s price', group: 1 },
      { term: '`gold / silver`', group: 0 },
    ],
    explain: 'Gold goes in and silver comes out, so gold rises and silver falls. The pool\'s price, `silver / gold`, '
      + 'falls: gold is cheaper there once a trader sells it gold. `gold / silver` is the same price the other way up.',
  },
  {
    kind: 'context',
    setup: 'swap (Swap GoldForSilver 100 0) (Pool 100 100)',
    question: 'The pool\'s price was 1 silver per gold. How many silver did the trader get per gold paid?',
    answer: '0.5',
    wrong: ['1', '0.75', '0.25'],
    explain: '`amountOut` is `100 * 100 / 200` = 50: 50 silver for 100 gold, or 0.5 each. The pool becomes '
      + '`Pool 200 50`, priced at 50/200 = 0.25. The trader\'s average lies between the price before and after.',
  },
  {
    kind: 'context',
    setup: 'poolValue goldPrice pool',
    question: 'What is `goldPrice` here?',
    answer: 'The market price: what one gold is worth outside the pool',
    wrong: [
      'The pool\'s price, `silver / gold`, before the last swap',
      'The price the last swap got, `amountOut / amountIn`',
      'What the whole pool is worth, counted in silver',
    ],
    explain: '`goldPrice` comes from outside the pool. A trader\'s profit, counted in silver at that price, is exactly '
      + 'what `poolValue` loses. A gap between the two prices doesn\'t always leave a whole-unit swap that profits.',
  },
  {
    kind: 'sort',
    question: 'Which pool has each property?',
    groups: ['constant sum (chapter 1)', 'constant product', 'both'],
    items: [
      { term: 'Always trades one for one', group: 0 },
      { term: 'Can pay out a whole reserve', group: 0 },
      { term: 'Its price moves when it trades', group: 1 },
      { term: 'Never pays out a whole reserve', group: 1 },
      { term: 'Can lose value to a trade', group: 2 },
      { term: 'Refuses `amountIn` of 0 or less', group: 2 },
    ],
    explain: 'Constant sum trades one for one, so a trader can take a whole reserve. Constant product\'s price moves '
      + 'with each trade, and a swap always leaves some of each reserve. Either can lose value to a profitable trade.',
  },
  {
    kind: 'name',
    clue: 'I am why a swap the formula puts at 8/3 silver pays the trader 2.',
    answer: 'rounding down',
    wrong: ['price impact', 'a fee', '`OutputTooSmall`'],
    explain: '`swap` pays whole units and drops any fraction, so the trader never gets more than the exact formula. '
      + 'The pool keeps the rest, so `k` can\'t fall.',
  },
  {
    kind: 'name',
    clue: 'I am the error for a pool with nothing, or less, on one side. No trade can bring me about.',
    answer: '`EmptyPool`',
    wrong: ['`AmountNotPositive`', '`OutputTooSmall`', '`InsufficientLiquidity`'],
    explain: '`swap` checks the reserves second, after `amountIn`. A constant-product swap always leaves both '
      + 'reserves above zero, so only a pool that already had an empty side meets `EmptyPool`.',
  },
  {
    kind: 'name',
    clue: 'I am why a trader\'s average rate is always worse than the rate the pool showed before the trade.',
    answer: 'price impact',
    wrong: ['rounding down', 'a fee', 'arbitrage'],
    explain: 'Each unit paid in moves the pool\'s price before the next. Before rounding, the bigger the trade, the '
      + 'worse its average, though rounding to whole units can upset that. A constant-sum pool has none.',
  },
  {
    kind: 'name',
    clue: 'I am one number for the whole pool: its silver, plus its gold turned into silver at market rates.',
    answer: '`poolValue`',
    wrong: ['`k`', '`goldPrice`', '`silver / gold`'],
    explain: '`poolValue goldPrice pool = goldPrice * gold + silver`. A trade that profits at the market price takes exactly '
      + 'that profit out of `poolValue`, in either kind of pool.',
  },
]
