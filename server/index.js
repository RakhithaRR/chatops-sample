import http from "node:http";
import { Webhooks, createNodeMiddleware } from "@octokit/webhooks";
import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/rest";
import { handleCommand } from "./commands.js";

const {
  APP_ID,
  PRIVATE_KEY,
  WEBHOOK_SECRET,
  PORT = "3000",
} = process.env;

for (const [k, v] of Object.entries({ APP_ID, PRIVATE_KEY, WEBHOOK_SECRET })) {
  if (!v) {
    console.error(`Missing required env var: ${k}`);
    process.exit(1);
  }
}

const privateKey = PRIVATE_KEY.replace(/\\n/g, "\n");

const appAuth = createAppAuth({ appId: APP_ID, privateKey });

async function octokitForInstallation(installationId) {
  const { token } = await appAuth({ type: "installation", installationId });
  return new Octokit({ auth: token });
}

const webhooks = new Webhooks({ secret: WEBHOOK_SECRET });

webhooks.on("issue_comment.created", async ({ payload }) => {
  const body = payload.comment.body.trim();
  if (!body.startsWith("/")) return;
  if (payload.sender.type === "Bot") return;
  if (!payload.installation?.id) return;

  const octokit = await octokitForInstallation(payload.installation.id);
  await handleCommand({ octokit, payload });
});

webhooks.onError((error) => {
  console.error(`Webhook error: ${error.message}`);
});

const middleware = createNodeMiddleware(webhooks, { path: "/webhook" });

const server = http.createServer(async (req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  if (!(await middleware(req, res))) {
    res.writeHead(404);
    res.end();
  }
});

server.listen(Number(PORT), () => {
  console.log(`ChatOps webhook server listening on :${PORT}/webhook`);
});
