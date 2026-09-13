import { defineEvalConfig } from "eve/evals";

export default defineEvalConfig({
  timeoutMs: 120_000,
  maxConcurrency: 2,
});
