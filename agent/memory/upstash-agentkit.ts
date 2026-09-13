import { redisDocuments } from "@upstash/agentkit-eve/memory";
import { defineMemory } from "eve/memory";
import { fileMemory } from "eve/memory/file";
import { byPrincipal } from "eve/memory/scope";

export default defineMemory({
  description: "Recall and manage durable context for the current user.",
  provider: fileMemory({ backend: redisDocuments() }),
  scope: byPrincipal,
});
