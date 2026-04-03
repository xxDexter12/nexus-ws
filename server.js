import http from "http";
import { WebSocketServer } from "ws";

const server = http.createServer((req, res) => {
  res.writeHead(200, { "content-type": "text/plain" });
  res.end("ok");
});

const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws, req) => {
  console.log("WS_OPEN", req.headers["user-agent"] || "");
  ws.on("message", (msg) => {
    console.log("WS_TEXT", msg.toString());
  });
  ws.on("close", () => {
    console.log("WS_CLOSE");
  });
});

server.listen(process.env.PORT || 10000, () => {
  console.log("listening");
});
