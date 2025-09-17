// src/grpc/imagecompress.client.ts
import path from "node:path";
import { Metadata, credentials, status } from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";

const PROTO = path.join(process.cwd(), "proto/image_compress.proto");

type GrpcPackage = any;

export async function createImageCompressClient(address: string) {
  const pkgDef = protoLoader.loadSync(PROTO, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
  });
  const grpcPkg = (await import("@grpc/grpc-js")).loadPackageDefinition(pkgDef) as unknown as GrpcPackage;

  const pb = grpcPkg.imagecompress;
  const client = new pb.ImageCompress(address, credentials.createInsecure());

  function waitForReady(deadlineMs = 5000): Promise<void> {
    return new Promise((resolve, reject) => {
      client.waitForReady(Date.now() + deadlineMs, (err: Error | null) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  function makeMeta(apiKey?: string) {
    const md = new Metadata();
    if (apiKey) md.add("authorization", `Bearer ${apiKey}`);
    return md;
  }

  function CreateJob(req: any, md?: Metadata): Promise<any> {
    return new Promise((resolve, reject) => {
      client.CreateJob(req, md ?? new Metadata(), (err: any, res: any) => {
        if (err) return reject(err);
        resolve(res);
      });
    });
  }
  function GetJob(req: any, md?: Metadata): Promise<any> {
    return new Promise((resolve, reject) => {
      client.GetJob(req, md ?? new Metadata(), (err: any, res: any) => {
        if (err) return reject(err);
        resolve(res);
      });
    });
  }
  function GetJobResult(req: any, md?: Metadata): Promise<any> {
    return new Promise((resolve, reject) => {
      client.GetJobResult(req, md ?? new Metadata(), (err: any, res: any) => {
        if (err) return reject(err);
        resolve(res);
      });
    });
  }
  function ListJobs(req: any, md?: Metadata): Promise<any> {
    return new Promise((resolve, reject) => {
      client.ListJobs(req, md ?? new Metadata(), (err: any, res: any) => {
        if (err) return reject(err);
        resolve(res);
      });
    });
  }

  return {
    raw: client,
    waitForReady,
    makeMeta,
    CreateJob,
    GetJob,
    GetJobResult,
    ListJobs,
    status,
  };
}
