import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import { fileURLToPath } from "url";
import router from "./routes";
import { logger } from "./lib/logger";
import { findMobileUser, isValidInstallId } from "./lib/mobile-store";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", async (req, res, next) => {
  const installId = req.header("x-tnc-install-id");
  if (!installId || req.path === "/mobile/open") {
    next();
    return;
  }
  if (!isValidInstallId(installId)) {
    res.status(400).json({ error: "Invalid mobile install ID" });
    return;
  }
  try {
    const user = await findMobileUser(installId);
    if (user?.is_blocked) {
      res.status(403).json({ error: user.blocked_reason ?? "This app installation is blocked" });
      return;
    }
    next();
  } catch (err) {
    logger.error({ err }, "Mobile install access check failed");
    res.status(503).json({ error: "Mobile access check is temporarily unavailable" });
  }
});

app.use("/api", router);

// In production, serve the built frontend from the same process
if (process.env.NODE_ENV === "production") {
  const frontendDist = path.resolve(process.cwd(), "artifacts/tnc-web/dist/public");
  app.use(express.static(frontendDist));
  // SPA fallback — serve index.html for all non-API routes
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });
  logger.info({ frontendDist }, "Serving frontend static files");
}

export default app;
