import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { z } from "zod";
import { hnItemSchema, type HnItem } from "../../src/lib/hn";

const itemsBody = z.array(hnItemSchema);
const idsBody = z.object({ ids: z.array(z.number().int()) });

export type FakeHn = { url: string; close: () => Promise<void> };

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.from(chunk));
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function send(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

export async function startFakeHn(): Promise<FakeHn> {
  const items = new Map<number, HnItem>();
  const heldIds = new Set<number>();
  let waiting: Array<() => void> = [];

  function releaseAll(): void {
    heldIds.clear();
    const callbacks = waiting;
    waiting = [];
    callbacks.forEach((callback) => callback());
  }

  async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const path = new URL(request.url ?? "/", "http://localhost").pathname;

    if (request.method === "PUT" && path === "/__items") {
      itemsBody.parse(await readJson(request)).forEach((item) => items.set(item.id, item));
      return send(response, 204, null);
    }
    if (request.method === "POST" && path === "/__hold") {
      idsBody.parse(await readJson(request)).ids.forEach((id) => heldIds.add(id));
      return send(response, 204, null);
    }
    if (request.method === "POST" && path === "/__release") {
      releaseAll();
      return send(response, 204, null);
    }
    if (request.method === "POST" && path === "/__reset") {
      items.clear();
      releaseAll();
      return send(response, 204, null);
    }

    const match = /^\/item\/(\d+)\.json$/.exec(path);
    if (request.method === "GET" && match) {
      const id = Number(match[1]);
      if (heldIds.has(id)) {
        await new Promise<void>((resolve) => waiting.push(resolve));
      }
      return send(response, 200, items.get(id) ?? null);
    }
    send(response, 404, { error: `no route for ${request.method} ${path}` });
  }

  const server: Server = createServer((request, response) => {
    handle(request, response).catch((error: unknown) => send(response, 500, { error: String(error) }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise((resolve) => {
        releaseAll();
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}
