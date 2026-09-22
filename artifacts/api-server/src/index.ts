import app from "./app";
import { logger } from "./lib/logger";
import { initBot, setupWebhook } from "./lib/bot";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Initialize Telegram bot
  const botInstance = initBot();
  if (botInstance) {
    const webhookBaseUrl = process.env.BOT_WEBHOOK_URL ?? process.env.PUBLIC_APP_URL ?? process.env.RENDER_URL ?? "https://courses.tncnursing.site";
    void setupWebhook(`${webhookBaseUrl.replace(/\/$/, "")}/api/bot/webhook`);
  }
});
