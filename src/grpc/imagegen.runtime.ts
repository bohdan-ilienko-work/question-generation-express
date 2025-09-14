import { realtimeService } from "@/realtime/realtime.service";
import { startGeneratorGrpcServer } from "./imagegen.server";

/** Starts the Generator gRPC server that accepts found links */
export async function startImageGenInboundGrpc() {
  const address = process.env.GENERATOR_GRPC_ADDR || "0.0.0.0:50041";
  const inboundApiKey = process.env.GENERATOR_GRPC_API_KEY || process.env.GRPC_API_KEY;

  const server = await startGeneratorGrpcServer(
    address,
    async ({ questionId, links, origin, metadata }) => {
      // Pretty console logs
      const count = Array.isArray(links) ? links.length : 0;
      // eslint-disable-next-line no-console
      console.log(`↘️  AcceptFoundLinks: questionId=${questionId} origin=${origin || "image-links"} count=${count}`);
      if (count) {
        // eslint-disable-next-line no-console
        console.log(
          links
            .slice(0, 5)
            .map((l, i) => `  [${i + 1}] ${l.title || "-"} -> ${l.url}`)
            .join("\n"),
        );
        if (links.length > 5) {
          // eslint-disable-next-line no-console
          console.log(`  ...and ${links.length - 5} more`);
        }
      }

      // Push to WebSocket subscribers
      realtimeService.notifyFoundLinks({ questionId, links, origin });

      return { ok: true, message: `received ${count} link(s)` };
    },
    { inboundApiKey },
  );

  return server;
}
