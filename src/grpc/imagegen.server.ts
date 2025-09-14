import path from "node:path";
import { type Metadata, Server, ServerCredentials, status } from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";

const PROTO = path.join(process.cwd(), "proto/imagegen.proto");

type GrpcPackage = any;

export type AcceptFoundLinksHandler = (payload: {
  questionId: string;
  links: Array<{ url: string; title: string; source: string }>;
  origin?: string;
  metadata: Metadata;
}) => Promise<{ ok: boolean; message?: string }>;

export async function startGeneratorGrpcServer(
  address: string,
  handler: AcceptFoundLinksHandler,
  opts?: { inboundApiKey?: string },
) {
  const pkgDef = protoLoader.loadSync(PROTO, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
  });
  const grpcPkg = (await import("@grpc/grpc-js")).loadPackageDefinition(pkgDef) as unknown as GrpcPackage;
  const pb = grpcPkg.imagegen;

  const server = new Server();

  server.addService(pb.Generator.service, {
    // rpc AcceptFoundLinks (AcceptFoundLinksRequest) returns (Ack)
    AcceptFoundLinks: async (call: any, callback: any) => {
      try {
        // простая проверка “пароля” по metadata
        if (opts?.inboundApiKey) {
          const auth = (call.metadata.get("authorization")[0] || "") as string;
          const token = typeof auth === "string" ? auth : "";
          const ok = token === `Bearer ${opts.inboundApiKey}` || token === opts.inboundApiKey;
          if (!ok) {
            return callback({ code: status.UNAUTHENTICATED, message: "invalid api key" }, null);
          }
        }

        const req = call.request as {
          questionId: string;
          links: Array<{ url: string; title: string; source: string }>;
          origin?: string;
        };

        const res = await handler({
          questionId: req.questionId,
          links: req.links ?? [],
          origin: req.origin,
          metadata: call.metadata,
        });

        callback(null, { ok: !!res.ok, message: res.message ?? "" });
      } catch (e: any) {
        callback({ code: status.INTERNAL, message: e?.message || "internal error" }, null);
      }
    },
  });

  await new Promise<void>((resolve, reject) => {
    server.bindAsync(address, ServerCredentials.createInsecure(), (err, port) => {
      if (err) return reject(err);
      resolve();
    });
  });

  server.start();
  return server;
}
