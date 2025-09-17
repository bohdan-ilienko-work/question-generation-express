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

export type VariantFormat = { ext: string; mime: string };
export type VariantMetadata = { format: VariantFormat; width: number; height: number; size: number };
export type Variant = { data: Buffer; metadata: VariantMetadata };

export type AcceptCompressedImageHandler = (payload: {
  questionId: string;
  name: string;
  hash: string;
  high: Variant;
  low: Variant;
  origin?: string;
  metadata: Metadata;
}) => Promise<{ ok: boolean; message?: string }>;

export type StartGeneratorGrpcServerHandlers = {
  onFoundLinks: AcceptFoundLinksHandler;
  onCompressedImage: AcceptCompressedImageHandler;
};

export async function startGeneratorGrpcServer(
  address: string,
  handlers: StartGeneratorGrpcServerHandlers,
  opts?: { inboundApiKey?: string; maxMessageBytes?: number },
) {
  const pkgDef = protoLoader.loadSync(PROTO, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    // bytes -> Buffer
    bytes: Buffer,
  });
  const grpcPkg = (await import("@grpc/grpc-js")).loadPackageDefinition(pkgDef) as unknown as GrpcPackage;
  const pb = grpcPkg.imagegen;

  const server = new Server({
    "grpc.max_receive_message_length": opts?.maxMessageBytes ?? 64 * 1024 * 1024,
    "grpc.max_send_message_length": opts?.maxMessageBytes ?? 64 * 1024 * 1024,
  });

  function checkAuth(metadata: Metadata): { ok: boolean; err?: any } {
    if (!opts?.inboundApiKey) return { ok: true };
    const raw = (metadata.get("authorization")[0] || "") as string;
    const token = typeof raw === "string" ? raw : "";
    const ok = token === `Bearer ${opts.inboundApiKey}` || token === opts.inboundApiKey;
    return ok ? { ok } : { ok, err: { code: status.UNAUTHENTICATED, message: "invalid api key" } };
  }

  server.addService(pb.Generator.service, {
    // rpc AcceptFoundLinks (AcceptFoundLinksRequest) returns (Ack)
    AcceptFoundLinks: async (call: any, callback: any) => {
      try {
        const auth = checkAuth(call.metadata);
        if (!auth.ok) return callback(auth.err, null);

        const req = call.request as {
          questionId: string;
          links: Array<{ url: string; title: string; source: string }>;
          origin?: string;
        };

        const res = await handlers.onFoundLinks({
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

    // NEW: rpc AcceptCompressedImage (AcceptCompressedImageRequest) returns (Ack)
    AcceptCompressedImage: async (call: any, callback: any) => {
      try {
        const auth = checkAuth(call.metadata);
        if (!auth.ok) return callback(auth.err, null);

        const req = call.request as {
          questionId: string;
          name: string;
          hash: string;
          origin?: string;
          high: { data: Buffer; metadata: VariantMetadata };
          low: { data: Buffer; metadata: VariantMetadata };
        };

        const res = await handlers.onCompressedImage({
          questionId: req.questionId,
          name: req.name,
          hash: req.hash,
          high: { data: req.high?.data ?? Buffer.alloc(0), metadata: req.high?.metadata as VariantMetadata },
          low: { data: req.low?.data ?? Buffer.alloc(0), metadata: req.low?.metadata as VariantMetadata },
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
    server.bindAsync(address, ServerCredentials.createInsecure(), (err) => {
      if (err) return reject(err);
      resolve();
    });
  });

  server.start();
  return server;
}
