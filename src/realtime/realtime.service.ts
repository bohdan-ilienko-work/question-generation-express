import { logger } from "@/server";
import { getIO, roomForQuestion } from "./socket";

export type FoundLink = { url: string; title: string; source: string };

export class RealtimeService {
  /** Broadcasts that links were found for a question */
  notifyFoundLinks(payload: {
    questionId: string;
    links: FoundLink[];
    origin?: string;
  }) {
    logger.info(
      {
        questionId: payload.questionId,
        origin: payload.origin || "image-links",
        count: Array.isArray(payload.links) ? payload.links.length : 0,
        preview: payload.links.slice(0, 3).map((l) => ({ title: l.title, url: l.url })),
      },
      "🔔 notifyFoundLinks",
    );
    const io = getIO();
    const { questionId, links, origin } = payload;
    const event = "images:links-found";
    const message = {
      questionId,
      origin: origin || "image-links",
      count: Array.isArray(links) ? links.length : 0,
      links,
      ts: Date.now(),
    };

    // Broadcast to a question-specific room (subscribed clients)
    io.to(roomForQuestion(questionId)).emit(event, message);
    // Also broadcast globally (optional)
    io.emit(event, message);
  }
}

export const realtimeService = new RealtimeService();
