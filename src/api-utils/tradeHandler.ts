import dexterity, { Trader } from "@hxronetwork/dexterity-ts";
import { sendTradeMessageToUser } from "../bot";
import { Trade } from "./types";

export const tradeHandler = async (
req: Request,
trader: Trader,
CopiedTrader: undefined | Trader,
AppState: Map<string, any>
) => {
if (req.method != "POST") {
  return new Response(
    JSON.stringify({ error: "Wrong method, this request is POST" }),
    { status: 570 }
  );
}
if (!CopiedTrader) {
  return new Response(
    JSON.stringify({ error: "You have not set a trader to copy" }),
    { status: 590 }
  );
}

const body = (await req.json()) as Trade;

if (
  body.maker != CopiedTrader.traderRiskGroup.toBase58() &&
  body.taker != CopiedTrader.traderRiskGroup.toBase58()
)
  return new Response(
    JSON.stringify({
      error: "Trade does not have CopiedTrader in it",
      maker: body.maker,
      taker: body.taker,
      copiedTrader: CopiedTrader.traderRiskGroup.toBase58(),
      isThereCopiedTrader:
        body.maker != CopiedTrader.traderRiskGroup.toBase58() &&
        body.taker != CopiedTrader.traderRiskGroup.toBase58(),
    }),
    { status: 590 }
  );

const positioningRatio = AppState.get("positioningRatio");

const sizeFractional = dexterity.Fractional.New(
  Math.floor((body.base_size * positioningRatio ?? 0) * 10),
  1
);

const isBid =
  (body.taker_side === "ask") ===
  (body.maker === CopiedTrader.traderRiskGroup.toBase58());

const maxSlippageAmount = body.price * 0.05;

const adjustedPrice = isBid
  ? body.price + maxSlippageAmount
  : body.price - maxSlippageAmount;

const priceFractional = dexterity.Fractional.New(
  Math.floor(adjustedPrice * 1000),
  3
);

await trader.connect(NaN, NaN);
trader.disconnect();

let productIndex;
for (const [name, { index }] of trader.getProducts()) {
  if (!name.includes(body.product)) {
    continue;
  }
  productIndex = index;
  break;
}

console.log({
  productName: body.product,
  productIndex,
  isBid,
  priceFractional: priceFractional.toDecimal(),
  sizeFractional: sizeFractional.toDecimal(),
  positioningRatio,
});

await trader.updateMarkPrices();
const signature = await trader.newOrder(
  productIndex,
  isBid,
  priceFractional,
  sizeFractional,
  0,
  null,
  null,
  null,
  null,
  {}
);

const tradeInfo = {
  signature,
  productName: body.product,
  productIndex,
  isBid,
  priceFractional: priceFractional.toDecimal(),
  sizeFractional: sizeFractional.toDecimal(),
  positioningRatio,
};

sendTradeMessageToUser(tradeInfo);

return new Response(
  JSON.stringify({
    ok: "completed copy-trade",
    tradeInfo,
  }),
  {
    status: 200,
  }
);
};
