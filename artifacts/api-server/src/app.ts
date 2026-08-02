import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { createProxyMiddleware } from "http-proxy-middleware";
import router from "./routes";
import { logger } from "./lib/logger";

const SHELFMIND_PORT = process.env.SHELFMIND_PORT || "8000";

const SHELFMIND_BACKEND_URL =
  process.env.SHELFMIND_BACKEND_URL || `http://localhost:${SHELFMIND_PORT}`;

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

// IMPORTANT: this proxy must be registered BEFORE express.json()/urlencoded() —
// otherwise the body parser drains the request stream and POST requests hang.
app.use(
  "/api/shelfmind",
  createProxyMiddleware({
    target: SHELFMIND_BACKEND_URL,
    changeOrigin: true,
    pathRewrite: { "^/api/shelfmind": "" },
    on: {
      error: (err, _req, res: any) => {
        res
          .status(502)
          .json({ error: "ShelfMind service unavailable", detail: String(err) });
      },
    },
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/api", router);

export default app;