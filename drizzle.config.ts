import type { Config } from "drizzle-kit";

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  driver: "d1-http",
  dbCredentials: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
    databaseId: "ca05c5b2-512c-4007-88a6-b2499e4cbd12",
    token: process.env.CLOUDFLARE_API_TOKEN!,
  },
} satisfies Config;
