import SmeeClient from "smee-client";

const { SMEE_URL, PORT = "3000" } = process.env;

if (!SMEE_URL) {
  console.error("SMEE_URL is not set. Add it to .env (see .env.example).");
  process.exit(1);
}

const smee = new SmeeClient({
  source: SMEE_URL,
  target: `http://localhost:${PORT}/webhook`,
  logger: console,
});

smee.start();
