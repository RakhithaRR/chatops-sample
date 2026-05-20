# ChatOps webhook server

A small Node service that handles the same `/command` comments as
[`../.github/workflows/chatops.yml`](../.github/workflows/chatops.yml),
but without GitHub Actions. This is the pattern used by bots like
CodeRabbit, Dependabot, and Renovate.

## How it differs from the workflow

| | Workflow (`chatops.yml`) | This server |
|---|---|---|
| Trigger | `issue_comment` event runs the YAML on a GitHub-hosted runner | GitHub POSTs the webhook directly to your URL |
| Latency | 5–30s cold start per command | ~100ms |
| Hosting | None | You run the process (Fly.io, Render, a VPS, etc.) |
| Setup per repo | Add the workflow file | Install the App once |

Both authenticate the same way: an installation token minted from the
GitHub App's private key.

## Layout

- `index.js` — HTTP server, webhook signature verification, App auth
- `commands.js` — the same `switch (cmd)` block from the workflow
- `.env.example` — required environment variables

Octokit's `App` + `createNodeMiddleware` handles signature verification
(`X-Hub-Signature-256`), installation token minting, and per-event
Octokit instances. You only write the command dispatch.

## Configure the GitHub App

In the App settings (same App as the workflow uses):

1. **Webhook URL** → your public endpoint, e.g. `https://chatops.example.com/webhook`
2. **Webhook secret** → any random string; put the same value in `WEBHOOK_SECRET`
3. **Subscribe to events** → check `Issue comment`
4. **Permissions** → Issues: Read & Write, Pull requests: Read & Write,
   Metadata: Read, Contents: Read

If you only have the App installed for the Actions workflow today, you
just need to add the webhook URL + secret and enable `Issue comment`.

## Run it locally

```sh
cd server
npm install
cp .env.example .env
# fill in APP_ID, PRIVATE_KEY, WEBHOOK_SECRET

# Forward GitHub webhooks to localhost via smee.io
# 1. Visit https://smee.io/new, copy the channel URL into SMEE_URL
# 2. Set the App's webhook URL to that smee.io URL
npm run tunnel &
npm run dev
```

Then comment `/hello` on any issue in a repo where the App is installed.

## Deploy it

Any platform that runs Node 20+ works. Set the three env vars
(`APP_ID`, `PRIVATE_KEY`, `WEBHOOK_SECRET`), expose port `3000`, and
point the App's webhook URL at `https://your-host/webhook`.

For `PRIVATE_KEY`, either paste the PEM with `\n` escapes, or mount the
`.pem` file and `export PRIVATE_KEY="$(cat /run/secrets/bot.pem)"` in
your start script.

## Extending

Add a new `case` to the `switch` in [`commands.js`](./commands.js). The
`octokit` passed to each handler is already authenticated as the App
installation for the repo that fired the event — any REST or GraphQL
call is one line away.
