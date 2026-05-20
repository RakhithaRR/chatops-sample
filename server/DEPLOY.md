# Deploying the ChatOps webhook server

This server is a stateless Node 20+ HTTP process. Anything that runs a
container or a long-lived Node script will work — Fly.io, Render,
Railway, Cloud Run, ECS, a $5 VPS with systemd. Pick whatever you
already operate.

Below: the non-negotiables, then a worked example for Fly.io, and notes
on the other common platforms.

## Pre-flight checklist

Before deploying anywhere, you need:

- [ ] A **GitHub App** with the right permissions (Issues + Pull requests: Read & write, Metadata: Read) and the **Issue comment** event subscribed.
- [ ] The App's **private key** downloaded as a `.pem`. Treat this like a password — anyone with it can act as your bot in every repo where it's installed.
- [ ] A **webhook secret** set in the App settings. Generate with `openssl rand -hex 32`.
- [ ] A **public HTTPS URL** for the server (no plain HTTP — GitHub will refuse to deliver, and signed payloads over HTTP defeat the point).
- [ ] The App installed on the repo(s) you want to operate on.

## Required environment variables

| Var | Notes |
|---|---|
| `APP_ID` | Numeric App ID from the App settings page. |
| `PRIVATE_KEY` | Full PEM contents. Either paste with `\n` escapes or mount the file and `export PRIVATE_KEY="$(cat /path/to/key.pem)"` in the start script. |
| `WEBHOOK_SECRET` | Must match the App's webhook secret exactly. |
| `PORT` | What the process binds to. Most platforms set this for you. |

**Never commit any of these.** They belong in your platform's secret
store, not in `.env` files in the repo. The `server/.gitignore` already
excludes `.env` and `*.pem`, but double-check before pushing.

## Update the GitHub App once you're deployed

In the App settings:
1. **Webhook URL** → your public endpoint (e.g. `https://chatops.example.com/webhook`)
2. **Active** → checked
3. Trigger a test comment, then check **Advanced → Recent Deliveries** for a `200`.

The smee.io URL is dev-only. You typically maintain two Apps — one
pointing at smee for dev, one pointing at production — so you can keep
developing without breaking the live bot.

## Containerize it

Add this `Dockerfile` next to `package.json`:

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY index.js commands.js ./
COPY scripts ./scripts
USER node
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "index.js"]
```

Notice: no `--env-file` flag. In production, env vars come from the
platform, not a `.env` file. The `npm run` aliases in `package.json` are
for local dev only.

Build and smoke-test:

```sh
docker build -t chatops-bot .
docker run --rm -p 3000:3000 \
  -e APP_ID=... -e WEBHOOK_SECRET=... -e PRIVATE_KEY="$(cat key.pem)" \
  chatops-bot
curl http://localhost:3000/health  # → {"ok":true}
```

## Worked example: Fly.io

Fly is a good fit because it gives you a free HTTPS hostname, a built-in
secret store, and runs the container above directly.

```sh
brew install flyctl
fly auth login
cd server
fly launch --no-deploy   # generates fly.toml; accept defaults, skip Postgres/Redis

# Store secrets (these stay encrypted, never written to disk)
fly secrets set APP_ID=123456
fly secrets set WEBHOOK_SECRET="$(openssl rand -hex 32)"
fly secrets set PRIVATE_KEY="$(cat path/to/bot.pem)"

fly deploy
fly status   # confirm the machine is "started"
```

Get the public URL with `fly info` (e.g. `https://chatops-bot.fly.dev`),
then update the GitHub App's webhook URL to
`https://chatops-bot.fly.dev/webhook`.

Watch logs live with `fly logs`. You'll see each command dispatched.

## Other platforms — what to do

**Render / Railway / Heroku-style PaaS.** Connect the repo, set the root
directory to `server/`, set start command to `node index.js`, add the
three env vars in the dashboard. The platform handles HTTPS and the
public URL.

**Cloud Run / Lambda / serverless.** Works, but pick a runtime that
keeps the container warm — cold starts add ~1s, and the signature
verification expects the body within a few seconds. Cloud Run with
`min-instances=1` is fine. Pure Lambda requires reworking around API
Gateway and is rarely worth it for low webhook volume.

**VPS + systemd.** Put the Node app behind nginx with a Let's Encrypt
cert. Run as a non-root user. Example unit:

```ini
[Service]
EnvironmentFile=/etc/chatops-bot.env
ExecStart=/usr/bin/node /opt/chatops-bot/index.js
User=chatops
Restart=on-failure
```

Make `/etc/chatops-bot.env` mode 600, owned by the `chatops` user.

## Hardening notes

These don't matter on day one, but matter once the bot has any real
authority in your org:

- **Restrict by IP.** GitHub publishes their webhook source ranges at
  `https://api.github.com/meta` (`hooks` field). If you're behind a WAF
  or load balancer, allowlist those ranges so randoms can't even reach
  your endpoint. Signature verification protects you either way, but
  defense in depth is cheap.
- **Log everything, but not the private key.** Structured JSON logs
  (one line per event, with delivery ID, command, actor, result) make
  incident triage tractable. Never log full payloads — they contain
  user content.
- **Per-command timeouts.** A handler that hangs blocks the response to
  GitHub. GitHub will retry on a non-2xx after ~10s, so wrap slow ops
  (deploys, external API calls) in `Promise.race` against a timeout, or
  ack the webhook immediately and do the work asynchronously.
- **Rotate the webhook secret periodically.** Set the new value in your
  platform secrets, deploy, *then* update it in the App settings.
  Signature verification will fail briefly during the swap — accept
  that or run two pods with old and new secrets during the cutover.
- **Rotate the private key if it ever leaks.** App settings → Generate
  a new private key, deploy, then revoke the old one. Existing
  installation tokens keep working for an hour after revocation, so
  there's no instant downtime.
- **Scope the App to specific repos** rather than installing
  org-wide unless you actually need every repo. Limits blast radius
  if the bot is ever compromised or buggy.

## Verifying a deploy

1. `curl https://your-host/health` returns `{"ok":true}`.
2. App settings → **Advanced → Recent Deliveries** → click any
   delivery → **Redeliver**. You should see a `200` response.
3. Post `/hello` on a test issue. Watch the server logs for
   `dispatch: /hello`, then see the bot's reply on the issue within ~1s.

If (1) works but (2) returns 4xx, your `WEBHOOK_SECRET` is wrong. If (2)
works but (3) doesn't reply, the App is missing permissions or isn't
installed on the test repo.
