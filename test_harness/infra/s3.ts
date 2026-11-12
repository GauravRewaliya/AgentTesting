// S3 for recorded sessions, against the local S3 emulator (test_harness/infra/docker-compose.yml, Adobe S3Mock: the same emulator loopferry uses for run outputs).
// Bun's built-in S3 client (path-style, any credentials work against S3Mock). For real AWS S3 set AT_S3_ENDPOINT="" and the usual keys.
//   bun test_harness/infra/s3.ts ping | ls [prefix] | cat <key>
import { S3Client } from "bun";

const E = process.env;
export const S3_ENDPOINT = E.AT_S3_ENDPOINT ?? `http://localhost:${E.AT_S3_PORT ?? 55442}`;
export const S3_BUCKET = E.AT_S3_BUCKET ?? "agent-testing-qa";
export const s3 = new S3Client({ endpoint: S3_ENDPOINT || undefined, bucket: S3_BUCKET, accessKeyId: E.AWS_ACCESS_KEY_ID ?? "test", secretAccessKey: E.AWS_SECRET_ACCESS_KEY ?? "test", region: E.AWS_REGION ?? "us-east-1" });

/** true when the bucket answers (docker compose up -d s3 was run). */
export async function s3Up(): Promise<boolean> { try { await s3.list({ maxKeys: 1 }); return true; } catch { return false; } }
export const putJson = (key: string, value: unknown) => s3.write(key, JSON.stringify(value, null, 1), { type: "application/json" });
export const getJson = async <T = unknown>(key: string): Promise<T> => JSON.parse(await s3.file(key).text()) as T;
export async function keys(prefix = ""): Promise<string[]> { const r = await s3.list({ prefix, maxKeys: 1000 }); return (r.contents ?? []).map((c) => c.key); }

if (import.meta.main) {
  const [cmd, arg] = process.argv.slice(2);
  if (cmd === "ping") console.log((await s3Up()) ? `ok: ${S3_ENDPOINT}/${S3_BUCKET}` : `NOT reachable: ${S3_ENDPOINT}/${S3_BUCKET} (docker compose -f test_harness/infra/docker-compose.yml up -d s3)`);
  else if (cmd === "ls") for (const k of await keys(arg ?? "")) console.log(k);
  else if (cmd === "cat" && arg) console.log(await s3.file(arg).text());
  else console.log("usage: bun test_harness/infra/s3.ts ping | ls [prefix] | cat <key>");
}
