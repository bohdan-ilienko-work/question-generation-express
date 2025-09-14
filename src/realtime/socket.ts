import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";

let io: Server | null = null;

/** Initializes singleton socket.io server */
export function initSocket(httpServer: HttpServer) {
  const path = process.env.WS_PATH || "/ws";
  io = new Server(httpServer, {
    path,
    cors: {
      origin: process.env.WS_CORS_ORIGIN?.split(",") || "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    // Optional: client can join a room for a specific question
    socket.on("subscribe:question", (questionId: string) => {
      if (typeof questionId === "string" && questionId.trim()) {
        socket.join(roomForQuestion(questionId));
      }
    });

    socket.on("unsubscribe:question", (questionId: string) => {
      if (typeof questionId === "string" && questionId.trim()) {
        socket.leave(roomForQuestion(questionId));
      }
    });
  });

  return io;
}

export function getIO(): Server {
  if (!io) throw new Error("Socket.io is not initialized");
  return io;
}

export function roomForQuestion(questionId: string) {
  return `question:${questionId}`;
}
