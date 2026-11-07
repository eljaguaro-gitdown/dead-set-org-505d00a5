/**
 * A CONNECT proxy that makes one browser context behave like a phone on a
 * given network, then hands every tunnel to the session's own egress proxy
 * ($HTTPS_PROXY) — this sandbox reaches the internet only through that.
 *
 * Model (per device, i.e. per proxy instance): every chunk in either
 * direction arrives one-way latency (rtt/2) after it was sent, and the
 * downstream bytes of ALL of the device's connections share one token bucket
 * at `downMbps`, upstream at `upMbps`. That is the same shape as Chrome
 * DevTools' throttling (per-request latency, a shared bandwidth cap), applied
 * to the TLS tunnel so it works for WebKit, which has no throttling of its
 * own. It ADDS to the sandbox's real latency to the Archive; the report
 * records an unthrottled profile alongside so the two can be told apart.
 */
import net from "node:net";

export function startThrottleProxy({ rttMs = 170, downMbps = 9, upMbps = 1.5, upstream = process.env.HTTPS_PROXY || process.env.https_proxy } = {}) {
  if (!upstream) throw new Error("throttle proxy: no HTTPS_PROXY to chain to");
  const up = new URL(upstream);
  const half = rttMs / 2;
  const bucket = { down: 0, up: 0 };
  const bytes = { down: 0, up: 0 };

  /** Write `chunk` to `dst` when latency and the shared bucket allow, in order. */
  const scheduler = (dst, dir, mbps) => {
    let lastAt = 0;
    return (chunk) => {
      const now = Date.now();
      const arrive = now + half;
      const cost = mbps > 0 ? (chunk.length * 8) / (mbps * 1000) : 0; // ms on the wire
      const start = Math.max(arrive, bucket[dir]);
      bucket[dir] = start + cost;
      const at = Math.max(start + cost, lastAt);
      lastAt = at;
      bytes[dir] += chunk.length;
      setTimeout(() => { if (!dst.destroyed) dst.write(chunk); }, Math.max(0, at - now));
    };
  };

  const server = net.createServer((client) => {
    let head = Buffer.alloc(0);
    const onData = (d) => {
      head = Buffer.concat([head, d]);
      const end = head.indexOf("\r\n\r\n");
      if (end < 0) return;
      client.removeListener("data", onData);
      const line = head.slice(0, end).toString().split("\r\n")[0];
      const m = /^CONNECT\s+(\S+)\s+HTTP/i.exec(line);
      if (!m) { client.end("HTTP/1.1 405 Method Not Allowed\r\n\r\n"); return; }
      const target = m[1];
      const rest = head.slice(end + 4);
      const upSock = net.connect(Number(up.port || 80), up.hostname, () => {
        upSock.write(`CONNECT ${target} HTTP/1.1\r\nHost: ${target}\r\n\r\n`);
      });
      let upHead = Buffer.alloc(0);
      const onUp = (d) => {
        upHead = Buffer.concat([upHead, d]);
        const e = upHead.indexOf("\r\n\r\n");
        if (e < 0) return;
        upSock.removeListener("data", onUp);
        const status = upHead.slice(0, e).toString().split("\r\n")[0];
        if (!/ 200 /.test(status)) { client.end(`${status}\r\n\r\n`); upSock.destroy(); return; }
        // The tunnel's own setup costs a round trip on a real phone too.
        setTimeout(() => {
          if (client.destroyed) { upSock.destroy(); return; }
          client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
          const toClient = scheduler(client, "down", downMbps);
          const toUp = scheduler(upSock, "up", upMbps);
          const tail = upHead.slice(e + 4);
          if (tail.length) toClient(tail);
          if (rest.length) toUp(rest);
          upSock.on("data", toClient);
          client.on("data", toUp);
        }, rttMs);
      };
      upSock.on("data", onUp);
      const kill = () => { client.destroy(); upSock.destroy(); };
      upSock.on("error", kill); client.on("error", kill);
      upSock.on("close", () => setTimeout(() => client.destroy(), half + 5));
      client.on("close", () => setTimeout(() => upSock.destroy(), half + 5));
    };
    client.on("data", onData);
    client.on("error", () => client.destroy());
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      resolve({
        url: `http://127.0.0.1:${server.address().port}`,
        bytes,
        close: () => new Promise((r) => server.close(() => r())),
      });
    });
  });
}
