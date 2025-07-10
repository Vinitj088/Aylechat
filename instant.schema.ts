// Docs: https://www.instantdb.com/docs/modeling-data

import { i } from "@instantdb/react";

const _schema = i.schema({
  entities: {
    $files: i.entity({
      path: i.string().unique().indexed(),
      url: i.string(),
    }),
    $users: i.entity({
      email: i.string().unique().indexed().optional(),
    }),
    profiles: i.entity({
      firstName: i.string(),
      userId: i.string().unique(),
    }),
    messages: i.entity({
      content: i.string().optional(),
      createdAt: i.date().indexed().optional(),
      role: i.string().optional(),
      citations: i.json().optional(),
      completed: i.boolean().optional(),
      startTime: i.number().optional(),
      endTime: i.number().optional(),
      tps: i.number().optional(),
      mediaData: i.json().optional(),
      weatherData: i.json().optional(),
      images: i.json().optional(),
      attachments: i.json().optional(),
      provider: i.string().optional(),
      quotedText: i.string().optional(),
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
      },
      reverse: {
        on: "threads",
        has: "many",
        label: "messages",
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
    userProfile: {
      forward: { on: "profiles", has: "one", label: "user" },
      reverse: { on: "$users", has: "one", label: "profile" },
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
