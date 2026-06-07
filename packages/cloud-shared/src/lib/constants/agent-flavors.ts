/**
 * Agent Flavor Presets — predefined Docker image configurations the cloud
 * dashboard exposes when a user creates a sandbox. The `eliza` flavor (default)
 * resolves its image at runtime via `containersEnv.defaultAgentImage()` so
 * operators can pin a tag without touching code (`ELIZA_AGENT_IMAGE` /
 * `CONTAINERS_DEFAULT_IMAGE` / legacy `AGENT_DOCKER_IMAGE`).
 *
 * Tags map to the continuous-publication workflow at
 * .github/workflows/build-agent-image.yml:
 *   :stable  — head of main
 *   :develop — head of develop
 *   :latest  — alias of :stable for legacy hardcoded callers
 */

import { containersEnv } from "../config/containers-env";

export interface AgentFlavor {
  id: string;
  name: string;
  description: string;
  dockerImage: string;
  defaultEnvVars?: Record<string, string>;
}

/**
 * Per-env flavor catalog.
 *   - production → only the stable `eliza` flavor + `custom`
 *   - staging    → only the `eliza-develop` flavor + `custom`
 *   - local dev / unset → both eliza flavors + `custom` (so devs can pick)
 *
 * `ENVIRONMENT` (set by wrangler.toml per-env) is the authoritative signal;
 * `NODE_ENV` is the fallback when ENVIRONMENT is not present (e.g. local Node
 * runs, Vite frontend builds where ENVIRONMENT is not exposed).
 */
function resolveEnvMode(): "production" | "staging" | "unknown" {
  const env = (typeof process !== "undefined" && process.env) || {};
  const explicit = env.ENVIRONMENT;
  if (explicit === "production") return "production";
  if (explicit === "staging") return "staging";
  // NODE_ENV=production with no ENVIRONMENT signal: treat as prod (Vite
  // production builds inline this; Worker prod sets NODE_ENV=production too).
  if (env.NODE_ENV === "production") return "production";
  return "unknown";
}

const FLAVOR_ELIZA_STABLE: AgentFlavor = {
  id: "eliza",
  name: "Eliza Agent",
  description:
    "V2 elizaOS agent — bridge API + Steward integration. Web UI enabled by default (token-gated by the agent-router via the per-agent ELIZA_API_TOKEN); disable per-agent with ELIZA_UI_ENABLE=false.",
  dockerImage: containersEnv.defaultAgentImage(),
};

const FLAVOR_ELIZA_DEVELOP: AgentFlavor = {
  id: "eliza-develop",
  name: "Eliza Agent (Develop)",
  description:
    "Latest develop build. Use for testing new features before they hit stable.",
  dockerImage: "ghcr.io/elizaos/eliza:develop",
};

const FLAVOR_CUSTOM: AgentFlavor = {
  id: "custom",
  name: "Custom Image",
  description: "Bring your own Docker image.",
  dockerImage: "",
};

/** Built-in flavors for the current deployment env. The first entry is the default. */
export function getAgentFlavorsForEnv(): AgentFlavor[] {
  const mode = resolveEnvMode();
  if (mode === "production") return [FLAVOR_ELIZA_STABLE, FLAVOR_CUSTOM];
  if (mode === "staging") return [FLAVOR_ELIZA_DEVELOP, FLAVOR_CUSTOM];
  // Local dev / unknown: surface both so devs can pick.
  return [FLAVOR_ELIZA_STABLE, FLAVOR_ELIZA_DEVELOP, FLAVOR_CUSTOM];
}

export function getFlavorById(id: string): AgentFlavor | undefined {
  return getAgentFlavorsForEnv().find((f) => f.id === id);
}

export function getDefaultFlavor(): AgentFlavor {
  return getAgentFlavorsForEnv()[0]!;
}
