import { Router, type IRouter } from "express";
import healthRouter from "./health";
import proxyRouter from "./proxy";
import botRouter from "./bot";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/bot", botRouter);
router.use(proxyRouter);

export default router;
