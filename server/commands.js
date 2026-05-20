const WRITE_LEVELS = new Set(["admin", "maintain", "write"]);

async function hasWriteAccess(octokit, owner, repo, username) {
  try {
    const { data } = await octokit.rest.repos.getCollaboratorPermissionLevel({
      owner, repo, username,
    });
    return WRITE_LEVELS.has(data.permission);
  } catch {
    return false;
  }
}

async function react(octokit, owner, repo, comment_id, content) {
  await octokit.rest.reactions.createForIssueComment({
    owner, repo, comment_id, content,
  });
}

export async function handleCommand({ octokit, payload }) {
  const { owner, name: repo } = payload.repository;
  const repoOwner = payload.repository.owner.login;
  const issue_number = payload.issue.number;
  const commentId = payload.comment.id;
  const actor = payload.sender.login;
  const body = payload.comment.body.trim();
  const [rawCmd, ...rest] = body.slice(1).split(/\s+/);
  const cmd = rawCmd.toLowerCase();
  const args = rest.join(" ");

  const reply = (message) =>
    octokit.rest.issues.createComment({
      owner: repoOwner, repo, issue_number, body: message,
    });

  if (!(await hasWriteAccess(octokit, repoOwner, repo, actor))) {
    console.log(`  skip: @${actor} lacks write access on ${repoOwner}/${repo}`);
    return;
  }
  console.log(`  dispatch: /${cmd} args=${JSON.stringify(args)}`);

  await react(octokit, repoOwner, repo, commentId, "eyes");

  let unknown = false;
  try {
    switch (cmd) {
      case "hello":
        await reply(`👋 Hi @${actor}!`);
        break;

      case "echo":
        await reply(args ? `🔁 ${args}` : "_nothing to echo_");
        break;

      case "label":
        if (!args) {
          await reply("Usage: `/label <name>`");
          break;
        }
        await octokit.rest.issues.addLabels({
          owner: repoOwner, repo, issue_number, labels: [args],
        });
        await reply(`🏷️ Added label \`${args}\``);
        break;

      case "close":
        await octokit.rest.issues.update({
          owner: repoOwner, repo, issue_number, state: "closed",
        });
        break;

      case "help":
        await reply([
          "**Available commands**",
          "- `/hello` — say hi",
          "- `/echo <text>` — echo text back",
          "- `/label <name>` — add a label",
          "- `/close` — close this issue/PR",
          "- `/help` — show this message",
        ].join("\n"));
        break;

      default:
        unknown = true;
        await reply(`❓ Unknown command \`/${cmd}\`. Try \`/help\`.`);
    }

    await react(
      octokit, repoOwner, repo, commentId,
      unknown ? "confused" : "rocket",
    );
  } catch (err) {
    console.error(`Command /${cmd} failed:`, err);
    await react(octokit, repoOwner, repo, commentId, "confused");
  }
}
