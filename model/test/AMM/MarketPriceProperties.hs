-- | Both pools against a market price: one gold is worth @price@ silver
-- elsewhere. Both lose value to a trader who swaps at a better price
-- than the market's, but only the constant-sum pool can be emptied.
module AMM.MarketPriceProperties (tests) where

import qualified AMM.ConstantProduct as CP
import qualified AMM.ConstantSum as CS
import AMM.ConstantProductProperties ()
import AMM.ConstantSumProperties ()
import Test.QuickCheck
import Test.Tasty (TestTree, testGroup)
import Test.Tasty.QuickCheck (testProperty)

tests :: TestTree
tests = testGroup "Market price"
  [ testProperty "constant sum: value at the market price never decreases (fails)"
      (expectFailure prop_sumValueNeverDecreases)
  , testProperty "constant product: value at the market price never decreases (fails)"
      (expectFailure prop_productValueNeverDecreases)
  , testProperty "constant sum: no swap empties a reserve (fails)"
      (expectFailure prop_sumNeverEmptied)
  , testProperty "constant product: no swap empties a reserve"
      prop_productNeverEmptied
  ]

-- | What a constant-sum pool holds, counted in silver, when one gold is
-- worth @goldPrice@ silver on the market.
sumPoolValue :: Rational -> CS.Pool -> Rational
sumPoolValue goldPrice (CS.Pool gold silver) =
  goldPrice * fromInteger gold + fromInteger silver

-- | Both reserves hold something.
sumPoolStocked :: CS.Pool -> Bool
sumPoolStocked pool = CS.gold pool > 0 && CS.silver pool > 0

-- | Both reserves hold something.
productPoolStocked :: CP.Pool -> Bool
productPoolStocked pool = CP.gold pool > 0 && CP.silver pool > 0

prop_sumValueNeverDecreases :: Positive Rational -> CS.Pool -> CS.Swap -> Property
prop_sumValueNeverDecreases (Positive goldPrice) pool s =
  case CS.swap s pool of
    Left _           -> property True
    Right (_, pool') -> property (sumPoolValue goldPrice pool' >= sumPoolValue goldPrice pool)

prop_productValueNeverDecreases :: Positive Rational -> CP.Pool -> CP.Swap -> Property
prop_productValueNeverDecreases (Positive goldPrice) pool s =
  case CP.swap s pool of
    Left _           -> property True
    Right (_, pool') -> property (CP.poolValue goldPrice pool' >= CP.poolValue goldPrice pool)

prop_sumNeverEmptied :: CS.Pool -> CS.Swap -> Property
prop_sumNeverEmptied pool s =
  sumPoolStocked pool ==>
    case CS.swap s pool of
      Left _           -> property True
      Right (_, pool') -> property (sumPoolStocked pool')

prop_productNeverEmptied :: CP.Pool -> CP.Swap -> Property
prop_productNeverEmptied pool s =
  productPoolStocked pool ==>
    case CP.swap s pool of
      Left _           -> property True
      Right (_, pool') -> property (productPoolStocked pool')
