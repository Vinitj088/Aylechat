import { betterAuth } from "better-auth";
import { db } from "./db";

export const auth = betterAuth({
  database: {
    type: "kysely",
    config: {
      db
    }
  },
  providers: [
    {
      id: "credentials",
      type: "credentials",
      authorize: async ({ credentials }: { credentials: any }) => {
        // This will be handled by our custom auth service
        return null;
      },
    },
  ],
});