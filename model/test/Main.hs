module Main (main) where

import qualified AMM.ConstantProductProperties
import qualified AMM.ConstantSumProperties
import qualified AMM.MarketPriceProperties
import Test.Tasty (defaultMain, testGroup)

main :: IO ()
main = defaultMain $ testGroup "amm-model"
  [ AMM.ConstantSumProperties.tests
  , AMM.ConstantProductProperties.tests
  , AMM.MarketPriceProperties.tests
  ]
