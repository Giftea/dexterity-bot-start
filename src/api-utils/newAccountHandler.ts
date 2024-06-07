const HeliusApiKey = process.env.APP_API_KEY;
const WebHookId = process.env.APP_WEBHOOK;

export const newAcccountSubscriptionHandler = async (newTrg: string) => {
    try {
        const response = await fetch(`https://api.helius.xyz/v0/webhooks/${WebHookId}?api-key=${HeliusApiKey}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              webhookURL: "https://trades-webhook-url.com/webhook",
              transactionTypes: ["Any"],
              accountAddresses: [newTrg],
              webhookType: "rawDevnet",
            }),
          }
        );
      
        const data = await response.json();
        console.log({ data });
      
      } catch (e) {
        console.error("error", e);
      }
};
