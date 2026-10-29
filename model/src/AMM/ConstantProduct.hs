-- | Chapter 2: a constant-product pool.
--
-- The pool holds gold and silver and pays out just enough that
-- @gold * silver@ stays the same. The price moves with every trade.
module AMM.ConstantProduct
  ( Pool (..)
  , Direction (..)
  , opposite
  , Swap (..)
  , SwapError (..)
  , swap
  , poolValue
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

-- | Pay @amountIn@ of one token and receive at least @minAmountOut@
-- of the other.
data Swap = Swap
  { direction    :: Direction
  , amountIn     :: Integer
  , minAmountOut :: Integer
  }
  deriving (Eq, Show)

-- | Why a swap was refused.
data SwapError
  = AmountNotPositive  -- ^ @amountIn@ is zero or negative.
  | EmptyPool          -- ^ A reserve is empty, so there is no price.
  | OutputTooSmall     -- ^ The swap would pay out nothing,
                       --   or less than @minAmountOut@.
  deriving (Eq, Show)

-- | Run a swap: the amount paid out and the pool afterwards,
-- or why it was refused.
swap :: Swap -> Pool -> Either SwapError (Integer, Pool)
swap (Swap direction amountIn minAmountOut) (Pool gold silver)
  | amountIn <= 0                = Left AmountNotPositive
  | gold <= 0 || silver <= 0     = Left EmptyPool
  | amountOut == 0
    || amountOut < minAmountOut  = Left OutputTooSmall
  | direction == GoldForSilver   =
      Right (amountOut, Pool (gold + amountIn)
                             (silver - amountOut))
  | otherwise                    =
      Right (amountOut, Pool (gold - amountOut)
                             (silver + amountIn))
  where
    -- keep reserveIn * reserveOut, rounding down in the pool's favour
    amountOut = reserveOut * amountIn `div` (reserveIn + amountIn)
    reserveIn  = if direction == GoldForSilver then gold else silver
    reserveOut = if direction == GoldForSilver then silver else gold

-- | The other way round.
opposite :: Direction -> Direction
opposite GoldForSilver = SilverForGold
opposite SilverForGold = GoldForSilver

-- | What the pool holds, counted in silver, when one gold is worth
-- @goldPrice@ silver on the market.
poolValue :: Rational -> Pool -> Rational
poolValue goldPrice (Pool gold silver) =
  goldPrice * fromInteger gold + fromInteger silver
