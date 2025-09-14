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
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(helmet());
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
app.use("/images", imagesRouter);

// Swagger UI
app.use(openAPIRouter);

// Error handlers
app.use(errorHandler());

// --- HTTP server + WebSockets bootstrap ---
const httpServer = http.createServer(app);
initSocket(httpServer); // now WS server is live on the same HTTP port

// --- gRPC server bootstrap (imagegen.Generator.AcceptFoundLinks) ---
(async () => {
  try {
    const address = process.env.GENERATOR_GRPC_ADDR || "0.0.0.0:50041";
    const inboundApiKey = process.env.GENERATOR_GRPC_API_KEY || process.env.GRPC_API_KEY;

    await startGeneratorGrpcServer(
      address,
      async ({ questionId, links, origin }) => {
        const count = Array.isArray(links) ? links.length : 0;

        // Console log
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

        // 🔔 Push to WebSocket subscribers (both room + broadcast)
        realtimeService.notifyFoundLinks({ questionId, links, origin });

        await imagesService.saveSuggestedLinks(questionId, links, origin);

        return { ok: true, message: `received ${count} link(s)` };
      },
      { inboundApiKey },
    );

    logger.info({ address }, "✅ gRPC Generator server started");
  } catch (err) {
    logger.error({ err }, "Failed to start gRPC Generator server");
  }
})();

export { app, httpServer, logger };
