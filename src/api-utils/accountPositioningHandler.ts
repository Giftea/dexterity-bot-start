import dexterity, { Trader } from "@hxronetwork/dexterity-ts";
import { TransactionInstruction } from "@solana/web3.js";

export const accountPositioningHandler = async (
AppState: Map<string, any>,
copiedTrader: Trader,
trader: Trader
) => {
const [traderInfo, copiedTraderInfo] = [
  await tradeInfoHandler(trader),
  await tradeInfoHandler(copiedTrader),
];
const positioningRatio =
  Math.floor(
    (copiedTraderInfo.portfolioValue / traderInfo.portfolioValue) * 1000
  ) / 1000;
AppState.set("positioningRatio", positioningRatio);

console.log(`Positioning Ratio: ${positioningRatio}`);

return await copyInitialAccountHandler(
  trader,
  traderInfo.positions,
  copiedTraderInfo.positions,
  positioningRatio
);
};

const tradeInfoHandler = async (trader: Trader) => {
await trader.update();

const positions = trader.getPositions();
const portfolioValue = trader.getPortfolioValue().toDecimal();

return { positions, portfolioValue };
};

const copyInitialAccountHandler = async (
trader: Trader,
traderPositions: Map<any, any>,
copiedTraderPositions: Map<any, any>,
positioningRatio: number
) => {
console.log(
  `Starting copy process with positioning ratio: ${positioningRatio}`
);
console.log(
  `Original Trader Positions:`,
  Array.from(traderPositions).map(([product, size]) => [
    product.trim(),
    size.toDecimal(),
  ])
);
console.log(
  `Copied Trader Positions:`,
  Array.from(copiedTraderPositions).map(([product, size]) => [
    product.trim(),
    size.toDecimal(),
  ])
);

const newOrders = [];
for (const [product, copierPosition] of copiedTraderPositions) {
  const copierSize = copierPosition.toDecimal();
  if (Math.abs(copierSize) == 0) continue;

  const traderPosition = traderPositions.get(product);
  const traderSize = traderPosition ? traderPosition.toDecimal() : 0;

  let adjustedSize = copierSize * positioningRatio;
  if (traderSize !== 0) {
    adjustedSize -= traderSize;
  }

  const isBid = adjustedSize > 0;
  console.log(
    `Adjusting position:\n -Product: ${product.trim()}\n -New Size: ${Math.abs(
      adjustedSize
    ).toFixed(1)}\n -Side = ${isBid ? "bid" : "ask"}`
  );

  newOrders.push({
    isBid,
    size: Math.abs(adjustedSize),
    product: product.trim(),
  });

  traderPositions.delete(product);
}

for (const [product, position] of traderPositions) {
  const size = position.toDecimal();
  if (Math.abs(size) > 0) {
    console.log(
      `Adjusting position:\n -Product: ${product.trim()}\n -New Size: ${Math.abs(
        size
      ).toFixed(1)}\n -Side = ${size > 0 ? "bid" : "ask"}`
    );
    newOrders.push({
      isBid: size < 0,
      size: Math.abs(size),
      product: product.trim(),
    });
  }
}

const newOrderIxs: TransactionInstruction[] = [];
const productMap = new Map<string, any>(
  Array.from(trader.getProducts()).map(([product, details]) => [
    product.trim(),
    details,
  ])
);

await trader.connect(NaN, NaN);
await trader.fetchAddressLookupTableAccount();

for (const [name, { index }] of Array.from(productMap)) {
  await trader.cancelAllOrders([name.trim()], true, undefined, 5);
}

for (const newOrder of newOrders) {
  const productDetails = productMap.get(newOrder.product);
  if (!productDetails) continue;

  const response = await fetch(
    `https://dexterity.hxro.com/mark_prices?product=${newOrder.product}`
  );
  const data = (await response.json()) as any;
  if (!data.mark_prices || data.mark_prices.length === 0) continue;

  let price = Number(data.mark_prices[0].mark_price);
  price = newOrder.isBid ? price + price * 0.05 : price - price * 0.05;

  const priceFractional = dexterity.Fractional.New(
    Math.floor(price * 1000),
    3
  );

  const sizeFractional = dexterity.Fractional.New(
    Math.floor(newOrder.size * 10),
    1
  );

  newOrderIxs.push(
    trader.getNewOrderIx(
      productDetails.index,
      newOrder.isBid,
      priceFractional,
      sizeFractional,
      0
    )
  );
}

if (newOrderIxs.length > 0) {
  const updateMarkPricesix = trader.getUpdateMarkPricesIx();
  return await trader.sendV0Tx([updateMarkPricesix, ...newOrderIxs]);
} else {
  return undefined;
}
};
