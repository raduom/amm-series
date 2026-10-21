module Main (main) where

import qualified AMM.ConstantSumProperties
import Test.Tasty (defaultMain, testGroup)

main :: IO ()
main = defaultMain $ testGroup "amm-model"
  [ AMM.ConstantSumProperties.tests
  ]
