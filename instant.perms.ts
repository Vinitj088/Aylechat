// Docs: https://www.instantdb.com/docs/permissions

import type { InstantRules } from "@instantdb/react";

const rules = {
  /**
   * Welcome to Instant's permission system!
   * Right now your rules are empty. To start filling them in, check out the docs:
   * https://www.instantdb.com/docs/permissions
   *
   * Here's an example to give you a feel:
   * posts: {
   *   allow: {
   *     view: "true",
   *     create: "isOwner",
   *     update: "isOwner",
   *     delete: "isOwner",
   *   },
   *   bind: ["isOwner", "auth.id != null && auth.id == data.ownerId"],
   * },
   */
  threads: {
    allow: {
      view: "auth.id == data.userId",
      create: "auth.id == data.userId",
      update: "auth.id == data.userId",
      delete: "auth.id == data.userId",
    },
  },
  messages: {
    allow: {
      view: "auth.id == data.ref('thread.userId')[0]",
      create: "auth.id == data.ref('thread.userId')[0]",
      update: "auth.id == data.ref('thread.userId')[0]",
      delete: "auth.id == data.ref('thread.userId')[0]",
    },
  },
} satisfies InstantRules;

export default rules;
