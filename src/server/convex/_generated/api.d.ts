/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agents from "../agents.js";
import type * as artifacts from "../artifacts.js";
import type * as briefs from "../briefs.js";
import type * as chat from "../chat.js";
import type * as crons from "../crons.js";
import type * as delegation from "../delegation.js";
import type * as email from "../email.js";
import type * as jobs from "../jobs.js";
import type * as model_agents from "../model/agents.js";
import type * as model_runs from "../model/runs.js";
import type * as office from "../office.js";
import type * as roles from "../roles.js";
import type * as runs from "../runs.js";
import type * as work from "../work.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  agents: typeof agents;
  artifacts: typeof artifacts;
  briefs: typeof briefs;
  chat: typeof chat;
  crons: typeof crons;
  delegation: typeof delegation;
  email: typeof email;
  jobs: typeof jobs;
  "model/agents": typeof model_agents;
  "model/runs": typeof model_runs;
  office: typeof office;
  roles: typeof roles;
  runs: typeof runs;
  work: typeof work;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  agent: import("@convex-dev/agent/_generated/component.js").ComponentApi<"agent">;
};
