// Docs: https://www.instantdb.com/docs/modeling-data

import { i } from "@instantdb/react";

const _schema = i.schema({
  // We inferred 5 attributes!
  // Take a look at this schema, and if everything looks good,
  // run `push schema` again to enforce the types.
  entities: {
    $files: i.entity({
      path: i.string().unique().indexed(),
      url: i.string(),
    }),
    $users: i.entity({
      email: i.string().unique().indexed().optional(),
    }),
    messages: i.entity({
      attachments: i.json().optional(),
      citations: i.json().optional(),
      completed: i.boolean().optional(),
      content: i.string().optional(),
      createdAt: i.date().indexed().optional(),
      endTime: i.number().optional(),
      images: i.json().optional(),
      mediaData: i.json().optional(),
      provider: i.string().optional(),
      quotedText: i.string().optional(),
      role: i.string().optional(),
      startTime: i.number().optional(),
      tps: i.number().optional(),
      weatherData: i.json().optional(),
    }),
    profiles: i.entity({
      firstName: i.string(),
      userId: i.string().unique(),
    }),
    threads: i.entity({
      createdAt: i.date().indexed().optional(),
      isPublic: i.boolean().indexed().optional(),
      model: i.string().optional(),
      shareId: i.string().unique().indexed().optional(),
      title: i.string().optional(),
      updatedAt: i.date().indexed().optional(),
    }),
  },
  links: {
    messagesThread: {
      forward: {
        on: "messages",
        has: "one",
        label: "thread",
        onDelete: "cascade",
      },
      reverse: {
        on: "threads",
        has: "many",
        label: "messages",
      },
    },
    profilesUser: {
      forward: {
        on: "profiles",
        has: "one",
        label: "user",
      },
      reverse: {
        on: "$users",
        has: "one",
        label: "profile",
      },
    },
    threadsUser: {
      forward: {
        on: "threads",
        has: "one",
        label: "user",
      },
      reverse: {
        on: "$users",
        has: "many",
        label: "threads",
      },
    },
  },
  rooms: {},
});

// This helps Typescript display nicer intellisense
type _AppSchema = typeof _schema;
interface AppSchema extends _AppSchema {}
const schema: AppSchema = _schema;

export type { AppSchema };
export default schema;
