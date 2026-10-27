import type { Card } from '../cards'

// Chapter 2's deck: the names in the constant-product model and the ideas behind them. Dealt in
// order, each term is defined, then put to work; the "Who am I?" cards at the end go over them again.
export const deck: Card[] = [
  {
    kind: 'define',
    term: 'amountIn',
    answer: 'How much the trader pays into the pool',
    wrong: [
      'How much the pool holds of the token paid in',
      'How much the swap pays out to the trader',
      'The least the trader will accept in return',
    ],
    explain: 'The trader picks `amountIn` and writes it into the `Swap`. It must be more than zero, or `swap` refuses '
      + 'with `AmountNotPositive`.',
  },
  {
    kind: 'define',
    term: 'reserveIn',
    answer: 'The pool\'s reserve of the token the trader pays in',
    wrong: [
      'The pool\'s reserve of the token the trader takes out',
      'The amount of the token the trader pays into the pool',
      'The pool\'s gold, whichever way the swap goes',
    ],
    explain: '`reserveIn` is the reserve that grows: `gold` in a `GoldForSilver` swap, `silver` in a `SilverForGold` '
      + 'one. `swap` picks it by `direction`.',
  },
  {
    kind: 'define',
    term: 'reserveOut',
    answer: 'The pool\'s reserve of the token the swap pays out',
    wrong: [
      'The pool\'s reserve of the token the trader pays in',
      'The amount of the token the swap pays to the trader',
      'What is left in the pool after the swap pays out',
    ],
    explain: '`reserveOut` is the reserve before the swap, the one `amountOut` is taken from: `silver` in a '
      + '`GoldForSilver` swap. A swap always pays out less than all of it.',
  },
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
    setup: 'swap (Swap SilverForGold 20 0) (Pool 50 80)',
    question: 'What is `reserveIn`?',
    answer: '80',
    aliases: ['80 silver'],
    explain: 'The trader pays silver, so `reserveIn` is the pool\'s silver, 80. `reserveOut` is its gold, 50.',
  },
  {
    kind: 'define',
    term: 'amountOut',
    answer: 'What the swap pays the trader, worked out from the reserves',
    wrong: [
      'The least the trader agrees to accept from the swap',
      'What the trader pays into the pool to make the swap',
      'What the trader would get at the pool\'s price before the swap',
    ],
    explain: '`swap` works out `reserveOut * amountIn / (reserveIn + amountIn)`, rounded down, so that '
      + '`gold × silver` does not fall. It is less than the pool\'s price would give, since the trade moves the price.',
  },
  {
    kind: 'context',
    setup: 'swap (Swap GoldForSilver 20 0) (Pool 60 90)',
    question: 'What is `amountOut`?',
    answer: '22',
    aliases: ['22 silver'],
    explain: '`90 * 20 / (60 + 20)` is 1800/80, or 45/2, rounded down to 22. The pool keeps the half and ends at '
      + '`Pool 80 68`.',
  },
  {
    kind: 'define',
    term: 'minAmountOut',
    answer: 'The least the trader accepts; below it the swap is refused',
    wrong: [
      'The smallest `amountIn` the pool lets a trader pay',
      'The silver or gold the swap works out to pay the trader',
      'The least the pool must keep in `reserveOut` after a swap',
    ],
    explain: 'The trader sets `minAmountOut`. If `amountOut` comes out below it, `swap` refuses with `OutputTooSmall` '
      + 'instead of paying less than the trader expected.',
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
    kind: 'define',
    term: 'k',
    answer: 'The product `gold × silver`, which no swap lowers',
    wrong: [
      'The sum `gold + silver`, which no swap changes',
      'The pool\'s price, `silver / gold`, which no swap changes',
      'The product `amountIn × amountOut`, the same for every swap',
    ],
    explain: 'Before rounding, the payout formula keeps `gold × silver` exactly the same. Rounding down only ever '
      + 'leaves the pool more, so `k` can rise but never falls. In chapter 1 it was `gold + silver` that stayed put.',
  },
  {
    kind: 'context',
    setup: 'swap (Swap GoldForSilver 10 0) (Pool 100 100)',
    question: '`k` is 10000 before the swap. What is it after?',
    answer: '10010',
    aliases: ['10,010'],
    explain: '`amountOut` is `100 * 10 / 110`, exactly 100/11, rounded down to 9. The pool becomes `Pool 110 91`, '
      + 'and 110 × 91 = 10010. The pool kept 1/11 of a silver, and 110 × 1/11 = 10 is what `k` gained.',
  },
  {
    kind: 'define',
    term: 'rounding down',
    answer: 'Paying the whole units and leaving the fraction in the pool',
    wrong: [
      'Paying the whole number nearest to the exact amount',
      'Paying the next whole number above the exact amount',
      'Keeping the fraction for the trader\'s next swap',
    ],
    explain: '`swap` drops any fraction of `amountOut`, so the trader never gets more than the exact formula gives. '
      + 'What is left over stays in the pool, which is why `k` never falls.',
  },
  {
    kind: 'define',
    term: 'EmptyPool',
    answer: 'The refusal when the pool\'s gold or silver is zero or less',
    wrong: [
      'The refusal when the swap would empty `reserveOut`',
      'The refusal when the trader pays in zero or less',
      'The refusal when the swap would pay out nothing',
    ],
    explain: 'Once `amountIn` has passed its check, `swap` refuses if either reserve is zero or less. A swap can\'t '
      + 'cause it: a constant-product swap always leaves both reserves above zero.',
  },
  {
    kind: 'define',
    term: 'OutputTooSmall',
    answer: 'The refusal when the swap would pay nothing, or less than `minAmountOut`',
    wrong: [
      'The refusal when `amountOut` would be more than the pool holds',
      'The refusal when `amountIn` is zero or less than zero',
      'The refusal when the trader sets `minAmountOut` to zero',
    ],
    explain: '`OutputTooSmall` covers two cases: `amountOut` rounds down to 0, or it falls short of the trader\'s '
      + '`minAmountOut`. Either way nothing changes hands.',
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
    kind: 'define',
    term: 'price impact',
    answer: 'How a swap moves the pool\'s price against the trader',
    wrong: [
      'How far the pool\'s price is from the market price',
      'The fraction of `amountOut` the pool keeps by rounding',
      'The gap between `amountOut` and `minAmountOut`',
    ],
    explain: 'Each unit paid in moves the price before the next, so the trader\'s average is worse than the price '
      + 'before. Before rounding, a bigger trade gets a worse average; rounding to whole units can upset that. '
      + 'Chapter 1\'s pool, paying one for one, had none.',
  },
  {
    kind: 'context',
    setup: 'swap (Swap GoldForSilver 100 0) (Pool 100 100)',
    question: 'The pool\'s price was 1 silver per gold. How many silver did the trader get per gold paid?',
    answer: '0.5',
    aliases: ['1/2', '½', '.5', 'half', 'a half', '0.5 silver per gold', 'half a silver per gold',
      'half a silver'],
    explain: '`amountOut` is `100 * 100 / 200` = 50: 50 silver for 100 gold, or 0.5 each. The pool becomes '
      + '`Pool 200 50`, priced at 50/200 = 0.25. The trader\'s average lies between the price before and after.',
  },
  {
    kind: 'define',
    term: 'poolValue',
    answer: 'What the pool holds, counted in silver, with gold at the market price',
    wrong: [
      'What the pool holds, counted in silver, with gold at the pool\'s price',
      'The product `gold × silver`, which no swap lowers',
      'The silver the pool would pay out for all of its own gold',
    ],
    explain: '`poolValue price pool` is `price * gold + silver`, where `price` is what one gold is worth on the '
      + 'market. It is how the chapter measures what a trader takes from the pool.',
  },
  {
    kind: 'context',
    setup: 'poolValue price pool',
    question: 'What is `price` here?',
    answer: 'The market price: what one gold is worth outside the pool',
    wrong: [
      'The pool\'s price, `silver / gold`, before the last swap',
      'The price the last swap got, `amountOut / amountIn`',
      'What the whole pool is worth, counted in silver',
    ],
    explain: '`price` comes from outside the pool. A trader\'s profit, counted in silver at that price, is exactly '
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
    clue: 'I am the number of tokens the trader gives up in a swap. If I am zero or less, the swap is refused.',
    answer: 'amountIn',
    aliases: ['input', 'input amount'],
    explain: '`amountIn` is part of the `Swap` the trader writes. `swap` checks it first and refuses with '
      + '`AmountNotPositive` if it is not above zero.',
  },
  {
    kind: 'name',
    clue: 'I am the side of the pool that grows in a swap: `gold` when the trader sells gold, `silver` when they '
      + 'sell silver.',
    answer: 'reserveIn',
    explain: '`reserveIn` is `gold` in a `GoldForSilver` swap and `silver` in a `SilverForGold` one: the reserve '
      + '`amountIn` is added to.',
  },
  {
    kind: 'name',
    clue: 'I am the side of the pool a swap takes from. I shrink with every trade but never reach zero.',
    answer: 'reserveOut',
    explain: '`amountOut` is taken from `reserveOut` and is always less than it, so the pool never runs out.',
  },
  {
    kind: 'name',
    clue: 'I am what the trader walks away with, worked out by `swap` and rounded down.',
    answer: 'amountOut',
    aliases: ['output', 'output amount', 'amount paid out', 'payout'],
    explain: '`amountOut` is `reserveOut * amountIn / (reserveIn + amountIn)`, rounded down. `swap` returns it with '
      + 'the pool afterwards.',
  },
  {
    kind: 'name',
    clue: 'I am the trader\'s floor: if the swap would pay less than me, it doesn\'t happen.',
    answer: 'minAmountOut',
    aliases: ['minimum amount out', 'minimum output', 'minOut'],
    explain: '`minAmountOut` protects the trader from getting much less than they expected, for example when the '
      + 'pool\'s price moved before their swap.',
  },
  {
    kind: 'name',
    clue: 'I am the number a swap is built to keep: the two reserves multiplied together.',
    answer: 'k',
    aliases: ['gold × silver', 'gold x silver', 'silver × gold', 'silver x gold', 'reserveIn × reserveOut',
      'reserveOut × reserveIn', 'x × y', 'xy'],
    explain: '`k = gold × silver`. Rounding down leaves the pool a little extra, so `k` stays the same or rises; it '
      + 'never falls.',
  },
  {
    kind: 'name',
    clue: 'I am why a swap the formula puts at 8/3 silver pays the trader 2.',
    answer: 'rounding down',
    aliases: ['round down', 'rounds down', 'rounded down', 'floor', 'flooring'],
    explain: '`swap` pays whole units and drops any fraction, so the trader never gets more than the exact formula. '
      + 'The pool keeps the rest, so `k` can\'t fall.',
  },
  {
    kind: 'name',
    clue: 'I am the error for a pool with nothing, or less, on one side. No trade can bring me about.',
    answer: 'EmptyPool',
    explain: '`swap` checks the reserves second, after `amountIn`. A constant-product swap always leaves both '
      + 'reserves above zero, so only a pool that already had an empty side meets `EmptyPool`.',
  },
  {
    kind: 'name',
    clue: 'I am the last check in `swap`. I stop a trade that would hand the trader 0, or under the least they set.',
    answer: 'OutputTooSmall',
    explain: '`OutputTooSmall` comes after the checks on `amountIn` and the reserves. It keeps a trader from paying '
      + 'in gold and getting 0 back, even with `minAmountOut` at 0.',
  },
  {
    kind: 'name',
    clue: 'I am the rate the pool\'s reserves set between its two tokens. Every swap moves me.',
    answer: 'the pool\'s price',
    aliases: ['pool price', 'price of the pool', 'silver / gold', 'silver per gold', 'spot price'],
    explain: 'The pool\'s price is `silver / gold`. Every swap moves it: selling gold to the pool makes gold cheaper '
      + 'there.',
  },
  {
    kind: 'name',
    clue: 'I am why a trader\'s average rate is always worse than the rate the pool showed before the trade.',
    answer: 'price impact',
    aliases: ['impact'],
    explain: 'Each unit paid in moves the pool\'s price before the next. Before rounding, the bigger the trade, the '
      + 'worse its average, though rounding to whole units can upset that. A constant-sum pool has none.',
  },
  {
    kind: 'name',
    clue: 'I am what gold sells for everywhere but this pool. The model can\'t look me up; it has to be told.',
    answer: 'the market price',
    aliases: ['market\'s price', 'price', 'outside price'],
    explain: 'The model can\'t see the market, so `poolValue` takes it as `price`. A profitable swap lowers '
      + '`poolValue` by exactly the trader\'s profit, counted in silver at this price.',
  },
  {
    kind: 'name',
    clue: 'I am one number for the whole pool: its silver, plus its gold turned into silver at market rates.',
    answer: 'poolValue',
    aliases: ['value of the pool', 'pool\'s value'],
    explain: '`poolValue price pool = price * gold + silver`. A trade that profits at the market price takes exactly '
      + 'that profit out of `poolValue`, in either kind of pool.',
  },
]
