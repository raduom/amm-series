-- | Chapter 1: a constant-sum pool.
--
-- The pool holds two tokens and trades them 1:1,
-- so @reserve0 + reserve1@ never changes.
module AMM.ConstantSum
  ( Pool (..)
  , Swap (..)
  , SwapError (..)
  , swap
  ) where

-- | How much of each token the pool holds.
data Pool = Pool
  { reserve0 :: Integer
  , reserve1 :: Integer
  }
  deriving (Eq, Show)

-- | Pay @amountIn@ of one token and receive the other.
-- @zeroForOne = True@ pays token0 and receives token1.
data Swap = Swap
  { zeroForOne :: Bool
  , amountIn   :: Integer
  }
  deriving (Eq, Show)

-- | Why a swap was refused.
data SwapError
  = AmountNotPositive      -- ^ @amountIn@ is zero or negative.
  | InsufficientLiquidity  -- ^ The pool holds less than the swap would pay out.
  deriving (Eq, Show)

-- | Run a swap: the amount paid out and the pool afterwards,
-- or why it was refused.
swap :: Swap -> Pool -> Either SwapError (Integer, Pool)
swap (Swap zeroForOne amountIn) (Pool reserve0 reserve1)
  | amountIn <= 0          = Left AmountNotPositive
  | amountOut > reserveOut = Left InsufficientLiquidity
  | zeroForOne             =
      Right (amountOut, Pool (reserve0 + amountIn) (reserve1 - amountOut))
  | otherwise              =
      Right (amountOut, Pool (reserve0 - amountOut) (reserve1 + amountIn))
  where
    amountOut  = amountIn  -- constant sum: one for one
    reserveOut = if zeroForOne then reserve1 else reserve0
