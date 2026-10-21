{-# OPTIONS_GHC -Wno-orphans #-}

-- | Properties of the constant-sum pool.
module AMM.ConstantSumProperties (tests) where

import AMM.ConstantSum
import Data.Either (isRight)
import Test.QuickCheck
import Test.Tasty (TestTree, testGroup)
import Test.Tasty.QuickCheck (testProperty)

tests :: TestTree
tests = testGroup "Constant sum"
  [ testProperty "the sum of the reserves is preserved" prop_sumPreserved
  , testProperty "the output equals the input"          prop_outputEqualsInput
  , testProperty "swapping back restores the pool"      prop_swapBackRestores
  , testProperty "reserves never go negative"           prop_reservesNonNegative
  ]

-- | A pool never starts with negative reserves.
instance Arbitrary Pool where
  arbitrary = Pool <$> nonNegative <*> nonNegative
    where
      nonNegative = getNonNegative <$> arbitrary
  shrink (Pool reserve0 reserve1) =
    [ Pool r0 r1 | (NonNegative r0, NonNegative r1) <- shrink (NonNegative reserve0, NonNegative reserve1) ]

-- | Any direction and any amount, including zero and negative ones the pool must refuse.
instance Arbitrary Swap where
  arbitrary = Swap <$> arbitrary <*> arbitrary
  shrink (Swap zeroForOne amountIn) = Swap zeroForOne <$> shrink amountIn

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

prop_sumPreserved :: Pool -> Swap -> Property
prop_sumPreserved pool s =
  whenSwapSucceeds pool s $ \_ pool' ->
    reserve0 pool' + reserve1 pool' === reserve0 pool + reserve1 pool

prop_outputEqualsInput :: Pool -> Swap -> Property
prop_outputEqualsInput pool s =
  whenSwapSucceeds pool s $ \amountOut _ ->
    amountOut === amountIn s

prop_swapBackRestores :: Pool -> Swap -> Property
prop_swapBackRestores pool s =
  whenSwapSucceeds pool s $ \amountOut pool' ->
    swap (Swap (not (zeroForOne s)) amountOut) pool' === Right (amountIn s, pool)

prop_reservesNonNegative :: Pool -> Swap -> Property
prop_reservesNonNegative pool s =
  whenSwapSucceeds pool s $ \_ pool' ->
    property (reserve0 pool' >= 0 && reserve1 pool' >= 0)
