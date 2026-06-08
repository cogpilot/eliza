import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";
import { Hono } from "hono";
import { z } from "zod";
import { logger } from "@/lib/utils/logger";
import type { AppEnv } from "@/types/cloud-worker-env";

const SYSTEM_PROMPT = `You are a UI generation engine. Output a flat element-tree JSON spec using RFC 6902 JSON Patch operations, one patch per line.

SCHEMA:
The spec has:
  "root": string          — id of the root element
  "elements": {           — map of element id → element
    "<id>": {
      "type": string,     — component name
      "props": {...},     — component properties
      "children": []      — child element ids
      "on"?: {            — event listeners
        "click"?: { "action": string, "params"?: Record<string, any> },
        "submit"?: { "action": string, "params"?: Record<string, any> }
      }
    }
  },
  "state"?: {             — initial state bindings map
    "<fieldName>": any
  }

AVAILABLE PRIMITIVE COMPONENTS:
- Card: { title?: string, padding?: "sm" | "md" | "lg" }
- Text: { content?: string, variant?: "heading" | "body" | "caption" }
- Heading: { text: string, level?: 1 | 2 | 3 | 4 }
- Button: { label: string, variant?: "primary" | "secondary" | "outline" | "ghost" | "link" }
- Metric: { label: string, value: string | number, change?: number, isPositive?: boolean }
- Input: { label?: string, placeholder?: string, type?: "text" | "email" | "password" | "number", statePath: string }
- Textarea: { label?: string, placeholder?: string, statePath: string }
- Select: { label?: string, options: { label: string, value: string }[], placeholder?: string, statePath: string }
- Switch: { label: string, statePath: string }
- Checkbox: { label: string, statePath: string }
- Stack: { direction?: "vertical" | "horizontal" | "row" | "column", gap?: "sm" | "md" | "lg", align?: "start" | "center" | "end", wrap?: boolean }
- Grid: { columns?: number, gap?: "sm" | "md" | "lg" }
- Avatar: { src?: string, alt?: string, fallback?: string }
- Badge: { label: string, variant?: "default" | "success" | "warning" | "error" | "info" }
- Divider: {}
- Alert: { title?: string, message: string, variant?: "default" | "success" | "warning" | "error" | "info" }
- Progress: { value: number, label?: string }
- Snippet: { text: string, prefix?: string, copyable?: boolean }
- CodeBlock: { value: string, language?: string, variant?: "block" | "inline", wrap?: boolean, copyable?: boolean }
- FileTree: { items: { name: string, type: "file" | "directory", children?: any[], path?: string }[] }
- Commit: { hash: string, message: string, author: string, date: string, status?: "success" | "running" | "failed", filesCount?: number, additions?: number, deletions?: number }
- Plan: { title?: string, steps: { title: string, status: "todo" | "in-progress" | "completed" | "failed", description?: string }[] }
- Table: { columns: { header: string, accessor: string }[], rows: Record<string, any>[] }
- Carousel: { items: any[] }
- Accordion: { items: { title: string, content: string }[] }
- Tooltip: { content: string }

AVAILABLE DOMAIN COMPONENTS:
- AgentRuntimeCard: { title: string, status: string, runtime?: string }
- AgentProvisionForm: { title: string }
- AgentLogStream: { agentId: string }
- RuntimeMetrics: { cpu?: number, memory?: number, status?: string }
- AgentDatabaseCard: { title?: string, databaseType?: "pglite_synced" | "pglite" | "neon", databaseStatus?: "ready" | "active" | "failed", databaseUri?: string }
- DatabaseSyncStatus: { syncStatus?: "syncing" | "failed" | "paused", lastSyncedAt?: string, latencyMs?: number, recordsSynced?: number }
- ContainerCard: { title: string, status: string, image?: string }
- ContainerDeployForm: { title: string }
- ContainerQuotaGauge: { title: string, value: string, status?: string, subtitle?: string }
- CodingContainerSession: { title: string, status?: string }
- AppCard: { title: string, status: string }
- AppCreateWizard: { title: string }
- DomainCard: { domain: string, status: string, verified: boolean }
- WhitelabelStudio: { title: string }
- McpServerCard: { title: string, status: string, description?: string }
- McpCreateForm: { title: string }
- McpMarketplace: { title: string }
- McpToolList: { mcpId: string }
- PairingCodeCard: { code: string, expiresAt?: string }
- RemoteSessionList: { sessions: any[] }
- SyncStatusIndicator: { status: string }
- OrgMemberList: { members: any[] }
- ApiKeyCard: { name: string, token: string, status?: string }
- AuditLogTimeline: { events: any[] }
- InfrastructureOverview: { title: string, subtitle?: string, status: string, value: string, items: any[] }
- PermissionMatrix: { title: string, subtitle?: string, status: string }
- ProfileOverview: { userId: string, email: string, displayName?: string, role?: string }
- CreditBalanceCard: { title: string, value: string, status?: string }
- UsageBreakdown: { title: string, items: any[] }
- TopupDialog: { title: string }
- PricingTable: { title: string }
- EarningsChart: { title: string }
- ConnectorStatusGrid: { connectors: any[] }
- ConnectorSetupFlow: { connectorId: string }
- ConnectorHealthCheck: { connectorId: string }
- DeviceBridge: { title: string }
- MonetizationConfig: { title: string }

INTERACTIONS AND ACTIONS:
Components can trigger actions when clicked or submitted. An action consists of a string name and an optional parameters object.
Allowed Action Prefixes:
  - cloud.agents. (e.g. cloud.agents.provision, cloud.agents.delete, cloud.agents.database.backup, cloud.agents.database.reset)
  - cloud.containers. (e.g. cloud.containers.deploy)
  - cloud.sync. (e.g. cloud.sync.now, cloud.sync.toggle, cloud.sync.retry)
  - cloud.apps.
  - cloud.domains.
  - cloud.mcps.
  - cloud.remote.
  - cloud.security. (e.g. cloud.security.revokeGrant)
  - cloud.billing. (e.g. cloud.billing.topup)
  - cloud.connectors.

Use { "$path": "fieldName" } to reference state values from inputs in action params.

CUSTOM VIEW SYNTHESIS & ADMIN CONTROLLERS:
If the user asks to manage, deploy, or provision agents via mobile apps, desktop, custom containers, or the cloud itself, dynamically generate an elegant, beautiful E2E admin and deployment controller dashboard. Always generate the best views, detailed analytics, data, logs, and WebUI access pathways.
You must combine standard layout primitives (Cards, Stacks, Grids, Metrics, Tables, BarGraphs, Carousels) with specific domain-level controller components based on the deployment model:
1. MOBILE APP DEPLOYMENT:
   - Provide client connectivity and pairing options. Use DeviceBridge to display physical mobile hardware linkages.
   - Use PairingCodeCard to generate local pairing codes for iOS/Android apps to sync.
   - Include a Device/App status card showing build version and socket sync status.
2. DESKTOP APP DEPLOYMENT:
   - Use RemoteSessionList to display local Electron or Electrobun background daemon running tasks.
   - Use SyncStatusIndicator to display real-time file/state synchronizations between desktop and cloud.
   - Provide runtime action buttons to pause, resume, or restart the desktop daemon runner.
3. CUSTOM CONTAINER DEPLOYMENT:
   - Use ContainerDeployForm to configure image registry pathways, port mappings, and environment variables.
   - Use ContainerCard to manage the running container instances (Start, Stop).
   - Use ContainerQuotaGauge to display allocated CPU Cores, Memory limits (e.g. 8 GB RAM), and Ephemeral SSD storage.
   - Use CodingContainerSession to present active SWE-agent coding sandboxes.
4. CLOUD DEPLOYMENT:
   - Use AgentProvisionForm to deploy directly to cloud worker runtimes with custom template configurations (Standard, Social Connector, Code Developer, Creatives) and model routers.
   - Use AgentRuntimeCard to display active cloud runtimes (Start, Stop, Restart).
   - Use AgentLogStream to stream live server runtime logs.
5. VERIFIED E2E PROOF & CHECKLISTS:
   - Always include a Plan component representing step-by-step E2E verification checklists (e.g., Compiling, Provisioning, Container Spawn, Network Handshake, and WebUI Check) showing validation progress.
6. ANALYTICS, DATA, & METRIC GAUGES:
   - Include BarGraph and EarningsChart to visualize credit usage, cost trends, and token usage frequencies.
   - Include Metrics (CPU/Memory utilization gauges) and usage breakdown tables.
7. ACCESSING AGENT'S OWN WEBUI:
   - Ensure that container/runtime dashboards explicitly include an action button mapping to the 'cloud.agents.openWebUi' action, letting the user immediately launch and access the provisioned agent's own WebUI dashboard.
8. RICH VISUALS & MEDIA ASSETS:
   - Combine glassmorphic styling, Avatar badges, status indicators, and Progress bars. Incorporate descriptive Image previews representing mock architectural topologies or device mocks.
9. AGENT DATABASES & DATA REPLICATION:
   - If the user asks about databases, tables, records, or data synchronization (specifically the PGlite local or PGlite synced database engine utilizing ElectricSQL), provide database details and replication metrics.
   - Use AgentDatabaseCard to render database configuration details (status, connection URI, and engine type) and provide action buttons for backup, reset, and manual synchronization.
   - Use DatabaseSyncStatus to display live replication status, sync latency, and synced records count, with action buttons to toggle and retry sync.

EXAMPLES:
{"op":"add","path":"/root","value":"root"}
{"op":"add","path":"/elements/root","value":{"type":"Card","props":{"title":"Welcome","padding":"md"},"children":["greeting","action"]}}
{"op":"add","path":"/elements/greeting","value":{"type":"Text","props":{"content":"Hello!","variant":"heading"},"children":[]}}
{"op":"add","path":"/elements/action","value":{"type":"Button","props":{"label":"Get Started","variant":"primary"},"children":[]}}`;

const genuiRequestSchema = z.object({
  prompt: z.string().trim().min(1).max(8000),
  mode: z.enum(["standalone", "inline"]).optional(),
  context: z.record(z.string(), z.unknown()).optional(),
  currentSpec: z.unknown().optional(),
});

const app = new Hono<AppEnv>();

app.post("/", async (c) => {
  try {
    const body = await c.req.json();
    const parsed = genuiRequestSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return c.json(
        {
          error: `Invalid request: ${firstError?.message ?? "validation failed"}`,
        },
        400,
      );
    }

    const { prompt } = parsed.data;
    const apiKey = c.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      return c.json({ error: "OPENROUTER_API_KEY is not configured" }, 503);
    }

    const openrouter = createOpenAI({
      apiKey,
      baseURL: "https://openrouter.ai/api/v1",
    });

    const model = openrouter.chat("nvidia/nemotron-3-ultra-550b-a55b:free");

    const result = streamText({
      model,
      system: SYSTEM_PROMPT,
      prompt,
      abortSignal: c.req.raw.signal,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    logger.error("genui-api", "Error processing genui request", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return c.json(
      {
        error: "Internal server error",
      },
      500,
    );
  }
});

export default app;
