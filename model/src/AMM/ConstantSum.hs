-- | Chapter 1: a constant-sum pool.
--
-- The pool holds gold and silver and trades them 1:1,
-- so @gold + silver@ never changes.
module AMM.ConstantSum
  ( Pool (..)
  , Direction (..)
  , opposite
  , Swap (..)
  , SwapError (..)
  , swap
  ) where

-- | How much of each token the pool holds.
data Pool = Pool
  { gold   :: Integer
  , silver :: Integer
  }
  deriving (Eq, Show)

-- | Which way a swap trades: gold for silver, or silver for gold.
data Direction
  = GoldForSilver
  | SilverForGold
  deriving (Eq, Show)

-- | Pay @amountIn@ of one token and receive the other.
data Swap = Swap
  { direction :: Direction
  , amountIn  :: Integer
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
swap (Swap direction amountIn) (Pool gold silver)
  | amountIn <= 0              = Left AmountNotPositive
  | amountOut > reserveOut     = Left InsufficientLiquidity
  | direction == GoldForSilver =
      Right (amountOut, Pool (gold + amountIn)
                             (silver - amountOut))
  | otherwise                  =
      Right (amountOut, Pool (gold - amountOut)
                             (silver + amountIn))
  where
    amountOut  = amountIn  -- constant sum: one for one
    reserveOut = if direction == GoldForSilver then silver else gold

-- | The other way round.
opposite :: Direction -> Direction
opposite GoldForSilver = SilverForGold
opposite SilverForGold = GoldForSilver
