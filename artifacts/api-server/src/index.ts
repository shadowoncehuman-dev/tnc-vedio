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
    const renderUrl = process.env.RENDER_URL;
    if (renderUrl) {
      setupWebhook(`${renderUrl}/api/bot/webhook`);
    } else {
      logger.info("RENDER_URL not set — bot webhook not configured (set it after deploying to Render)");
    }
  }
});
