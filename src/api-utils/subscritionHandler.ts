import { Manifest, Trader } from "@hxronetwork/dexterity-ts";
import { PublicKey } from "@solana/web3.js";
import { accountPositioningHandler } from "./accountPositioningHandler";

export const handleNewSubscription = async (
  trader: Trader,
  manifest: Manifest,
  newTrg: string | null,
  AppState: Map<string, any>
) => {
  if (newTrg == null) {
    return new Response(JSON.stringify({ error: "No trg was passed" }), {
      status: 500,
    });
  }

  const copiedTrader = new Trader(manifest, new PublicKey(newTrg), true);
  AppState.set("copiedTrader", copiedTrader);

  await newAcccountSubscriptionHandler(newTrg)

  return new Response(
    JSON.stringify({
      ok: "Successfully set new Trader to Copy",
      newTrg,
    }),
    { status: 200 }
  );
};

export const handleCancelSubscription = async (
  AppState: Map<string, Trader>
) => {
  AppState.delete("copiedTrader");
  return new Response(
    JSON.stringify({
      ok: "Successfully canceled trader subscription",
    }),
    { status: 200 }
  );
};