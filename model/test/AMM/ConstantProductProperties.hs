{-# OPTIONS_GHC -Wno-orphans #-}

-- | Properties of the constant-product pool.
module AMM.ConstantProductProperties (tests) where

import AMM.ConstantProduct
import Data.Either (isRight)
import Test.QuickCheck
import Test.Tasty (TestTree, testGroup)
import Test.Tasty.QuickCheck (testProperty)

tests :: TestTree
tests = testGroup "Constant product"
  [ testProperty "the product of the reserves never decreases"    prop_productNeverDecreases
  , testProperty "the output is below the reserve"                prop_outputBelowReserve
  , testProperty "the output is at least minAmountOut"            prop_outputAtLeastMinimum
  , testProperty "larger trades get worse prices (up to rounding)" prop_largerTradesWorsePrices
  , testProperty "a round trip never profits"                     prop_roundTripNeverProfits
  , testProperty "reserves stay positive"                         prop_reservesStayPositive
  ]

-- | A pool never starts with negative reserves.
instance Arbitrary Pool where
  arbitrary = Pool <$> nonNegative <*> nonNegative
    where
      nonNegative = getNonNegative <$> arbitrary
  shrink (Pool gold silver) =
    [ Pool g s | (NonNegative g, NonNegative s) <- shrink (NonNegative gold, NonNegative silver) ]

instance Arbitrary Direction where
  arbitrary = elements [GoldForSilver, SilverForGold]

-- | Any direction and any amounts, including ones the pool must refuse.
instance Arbitrary Swap where
  arbitrary = Swap <$> arbitrary <*> arbitrary <*> arbitrary
  shrink (Swap direction amountIn minAmountOut) =
    [ Swap direction a m | (a, m) <- shrink (amountIn, minAmountOut) ]

-- | Check a property of the swaps that succeed, and make sure enough of them do.
whenSwapSucceeds :: Pool -> Swap -> (Integer -> Pool -> Property) -> Property
whenSwapSucceeds pool s check =
  checkCoverage $
    cover 20 (isRight result) "swap succeeds" $
      case result of
        Left _                   -> property True
        Right (amountOut, pool') -> check amountOut pool'
  where
    result = swap s pool

-- | The reserve the swap pays out from.
reserveOut :: Swap -> Pool -> Integer
reserveOut s pool
  | direction s == GoldForSilver = silver pool
  | otherwise                    = gold pool

prop_productNeverDecreases :: Pool -> Swap -> Property
prop_productNeverDecreases pool s =
  whenSwapSucceeds pool s $ \_ pool' ->
    property (gold pool' * silver pool' >= gold pool * silver pool)

prop_outputBelowReserve :: Pool -> Swap -> Property
prop_outputBelowReserve pool s =
  whenSwapSucceeds pool s $ \amountOut _ ->
    property (amountOut < reserveOut s pool)

prop_outputAtLeastMinimum :: Pool -> Swap -> Property
prop_outputAtLeastMinimum pool s =
  whenSwapSucceeds pool s $ \amountOut _ ->
    property (amountOut >= minAmountOut s)

-- | Paying more never gets a better price, except by what rounding
-- took from the smaller trade: less than one unit of its output.
-- Compared without dividing: out' / in' < (out + 1) / in.
prop_largerTradesWorsePrices :: Pool -> Swap -> Positive Integer -> Property
prop_largerTradesWorsePrices pool s (Positive extra) =
  whenSwapSucceeds pool s $ \amountOut _ ->
    case swap larger pool of
      Left err              -> counterexample ("larger swap refused: " <> show err) False
      Right (amountOut', _) ->
        amountOut' >= amountOut
          .&&. amountOut' * amountIn s < (amountOut + 1) * amountIn larger
  where
    larger = s { amountIn = amountIn s + extra }

prop_roundTripNeverProfits :: Pool -> Swap -> Property
prop_roundTripNeverProfits pool s =
  whenSwapSucceeds pool s $ \amountOut pool' ->
    case swap (Swap (opposite (direction s)) amountOut 0) pool' of
      Left _          -> property True
      Right (back, _) -> property (back <= amountIn s)

prop_reservesStayPositive :: Pool -> Swap -> Property
prop_reservesStayPositive pool s =
  whenSwapSucceeds pool s $ \_ pool' ->
    property (gold pool' > 0 && silver pool' > 0)
