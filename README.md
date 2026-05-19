# chatops-sample

A minimal demo of ChatOps in GitHub: type a `/command` as a comment on an
issue or PR, and a GitHub Actions workflow reacts to it.

## How it works

1. You post a comment starting with `/` on any issue or PR.
2. GitHub fires the `issue_comment` webhook.
3. `.github/workflows/chatops.yml` runs, checks the commenter has write
   access to the repo, then dispatches on the command.
4. The bot reacts to your comment (👀 → 🚀 on success, 😕 on failure) and
   usually posts a reply.

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

Add a new `case` to the `switch` in the **Parse and run command** step.
The `github` object is the [Octokit REST client], so any GitHub API call
is one line away — trigger a deploy, dispatch a workflow, post to Slack,
etc.

[Octokit REST client]: https://octokit.github.io/rest.js/
