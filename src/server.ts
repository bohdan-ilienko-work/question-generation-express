import http from "node:http";
import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import { pino } from "pino";

import { openAPIRouter } from "@/api-docs/openAPIRouter";
import { authRouter } from "@/api/auth/authRouter";
import { healthCheckRouter } from "@/api/healthCheck/healthCheckRouter";
import { questionRouter } from "@/api/question/questionRouter";
import { statsRouter } from "@/api/stats/statsRouter";
import { userRouter } from "@/api/user/userRouter";
import errorHandler from "@/common/middleware/errorHandler";
import rateLimiter from "@/common/middleware/rateLimiter";
import requestLogger from "@/common/middleware/requestLogger";
import { env } from "@/common/utils/envConfig";
import { connectRedis } from "@/common/utils/redisClient";
import cookieParser from "cookie-parser";
import { categoryRouter } from "./api/category/categoryRouter";
import { imagesRouter } from "./api/images/imagesRouter";
// import { openaiRouter } from "./api/openai/openaiRouter";
import { connectMongoDB, connectMongoDBOld } from "./common/utils/mongoClient";
import { startGeneratorGrpcServer } from "./grpc/imagegen.server";

import { imagesService } from "./api/images/imagesService";
import { realtimeService } from "./realtime/realtime.service";
// sockets
import { initSocket } from "./realtime/socket";

const logger = pino({ name: "server start" });
const app: Express = express();

// Trust reverse proxy
app.set("trust proxy", true);

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const CLIENT_URL = env.CLIENT_URL || "http://localhost:5173";
app.use(cors({ origin: CLIENT_URL, credentials: true }));
// стало
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }, // <- разрешаем встраивание с других origin
    crossOriginEmbedderPolicy: false, // на всякий случай, чтобы не требовать require-corp
  }),
);
app.use(rateLimiter);
app.use(cookieParser());

// Request logging
app.use(requestLogger);

// DB/Cache
connectRedis();
connectMongoDB();
connectMongoDBOld();

// Routes
app.use("/health-check", healthCheckRouter);
app.use("/users", userRouter);
app.use("/auth", authRouter);
// app.use("/openai", openaiRouter);
app.use("/questions", questionRouter);
app.use("/stats", statsRouter);
app.use("/categories", categoryRouter);
app.use("/images", helmet.crossOriginResourcePolicy({ policy: "cross-origin" }), imagesRouter);

// Swagger UI
app.use(openAPIRouter);

// Error handlers
app.use(errorHandler());

// --- HTTP server + WebSockets bootstrap ---
const httpServer = http.createServer(app);
initSocket(httpServer); // now WS server is live on the same HTTP port
// --- gRPC server bootstrap (imagegen.Generator.*) ---
(async () => {
  try {
    const address = process.env.GENERATOR_GRPC_ADDR || "0.0.0.0:50041";
    const inboundApiKey = process.env.GENERATOR_GRPC_API_KEY || process.env.GRPC_API_KEY;
    const maxMsg = Number(process.env.GRPC_MAX_MSG_BYTES || 64 * 1024 * 1024);

    await startGeneratorGrpcServer(
      address,
      {
        // existed
        onFoundLinks: async ({ questionId, links, origin }) => {
          const count = Array.isArray(links) ? links.length : 0;

          logger.info(
            {
              questionId,
              origin: origin || "image-links",
              count,
              preview: links.slice(0, 3).map((l) => ({ title: l.title, url: l.url })),
            },
            "AcceptFoundLinks received",
          );
          if (count > 3) {
            logger.info({ more: count - 3 }, "AcceptFoundLinks truncated preview");
          }

          realtimeService.notifyFoundLinks({ questionId, links, origin });
          await imagesService.saveSuggestedLinks(questionId, links, origin);
          return { ok: true, message: `received ${count} link(s)` };
        },

        // NEW
        onCompressedImage: async ({ questionId, name, hash, high, low, origin }) => {
          const hi = high?.metadata;
          const lo = low?.metadata;

          logger.info(
            {
              questionId,
              name,
              origin: origin || "image-compress",
              high: { bytes: high?.data?.length ?? 0, w: hi?.width, h: hi?.height },
              low: { bytes: low?.data?.length ?? 0, w: lo?.width, h: lo?.height },
            },
            "AcceptCompressedImage received",
          );

          const res = await imagesService.saveCompressedImage({
            questionId,
            name,
            hash,
            high,
            low,
            origin,
          });

          const ok = !!res.success;
          return { ok, message: ok ? "stored" : res.message || "store error" };
        },
      },
      { inboundApiKey, maxMessageBytes: maxMsg },
    );

    logger.info({ address }, "✅ gRPC Generator server started");
  } catch (err) {
    logger.error({ err }, "Failed to start gRPC Generator server");
  }
})();

export { app, httpServer, logger };
