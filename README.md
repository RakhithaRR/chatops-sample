# chatops-sample

A minimal demo of ChatOps in GitHub: type a `/command` as a comment on an
issue or PR, and a bot reacts to it. Two implementations are included so
you can compare the tradeoffs:

- **GitHub Actions workflow** ([`.github/workflows/chatops.yml`](.github/workflows/chatops.yml)) — no hosting, runs on GitHub's runners, ~5–30s latency per command.
- **Standalone webhook server** ([`server/`](server/)) — the pattern bots like CodeRabbit / Dependabot use. You host a process; GitHub POSTs webhooks to it directly. ~100ms latency.

Both authenticate as the same GitHub App and end up calling the same
REST APIs — only the trigger path differs.

## How the workflow works

1. You post a comment starting with `/` on any issue or PR.
2. GitHub fires the `issue_comment` webhook.
3. `.github/workflows/chatops.yml` runs, checks the commenter has write
   access to the repo, then dispatches on the command.
4. The bot reacts to your comment (👀 → 🚀 on success, 😕 on failure) and
   usually posts a reply.

## How the webhook server works

Same dispatch logic, but the webhook is delivered to a long-running
Node process instead of an Actions runner. See [`server/README.md`](server/README.md)
for setup.

## Commands

| Command | What it does |
|---|---|
| `/hello` | Replies with a greeting |
| `/echo <text>` | Echoes `<text>` back as a comment |
| `/label <name>` | Adds `<name>` as a label on the issue/PR |
| `/close` | Closes the issue/PR |
| `/help` | Lists the commands above |

Unknown commands get a `❓` reply. Comments from users without write
access are ignored.

## Trying it

1. Push this repo to GitHub.
2. Open an issue.
3. Comment `/hello` and watch the Actions tab.

## Extending

Add a new `case` to the `switch` in both:
- the **Parse and run command** step of [`chatops.yml`](.github/workflows/chatops.yml), and
- [`server/commands.js`](server/commands.js).

Both expose an authenticated [Octokit REST client], so any GitHub API
call — trigger a deploy, dispatch a workflow, post to Slack, etc. — is
one line away.

[Octokit REST client]: https://octokit.github.io/rest.js/
