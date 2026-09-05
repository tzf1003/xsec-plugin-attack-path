import { readFile } from "node:fs/promises";

const ATTACK_PATH_PLUGIN = "com.xsec.attack-path";
const PLUGIN_ROOT = `plugins/${ATTACK_PATH_PLUGIN}`;
const EXPECTED_AGENT_TOOLS = [
  "attack-path-finding-add",
  "attack-path-findings-list",
  "attack-path-list",
  "attack-path-node-create",
  "attack-path-node-delete",
  "attack-path-node-get",
  "attack-path-node-update",
];
const EXPECTED_DEPENDENCY = "^1.2.3";
const EXPECTED_ACTIVATION = "onAgentTool:attack_path_node_create";
const EXPECTED_COMMAND = "./bin/attack-path-mcp";
const EXPECTED_CWD = "${PLUGIN_DATA}";

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function requireContract(condition, message) {
  if (!condition) throw new Error(message);
}

function sameEntries(actual, expected) {
  return JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort());
}

const [manifest, catalog, mcp] = await Promise.all([
  readJson(`${PLUGIN_ROOT}/plugin.json`),
  readJson(`${PLUGIN_ROOT}/.codex-plugin/plugin.json`),
  readJson(`${PLUGIN_ROOT}/mcp.json`),
]);
const extension = manifest.extensions?.["com.xsec.desktop"];
const server = mcp.mcpServers?.["attack-path"];
const agentTools = Object.keys(extension?.contributes?.agentTools ?? {});

requireContract(/^2\.\d+\.\d+$/.test(manifest.version), "attack-path must publish a v2 release");
requireContract(catalog.version === manifest.version, "catalog version must match plugin version");
requireContract(extension?.schemaVersion === 2, "attack-path must use schema v2");
requireContract(extension?.activationEvents?.includes(EXPECTED_ACTIVATION), "agent tool activation must name its contribution");
requireContract(
  extension?.dependencies?.required?.["com.xsec.workspace.sub-agent"] === EXPECTED_DEPENDENCY,
  "attack-path must target the published sub-agent contract",
);
requireContract(sameEntries(agentTools, EXPECTED_AGENT_TOOLS), "agent tools must match the native sidecar contract");
requireContract(server?.command === EXPECTED_COMMAND, "attack-path must use the packaged native sidecar");
requireContract(server?.cwd === EXPECTED_CWD, "attack-path runtime data must stay outside the package");

const frontendSource = await readFile(`${PLUGIN_ROOT}/com.xsec.desktop/frontend/index.js`, "utf8");
requireContract(
  /SUBAGENT_PLUGIN_ID\s*=\s*"com\.xsec\.workspace\.sub-agent"/.test(frontendSource),
  "attack-path frontend must retain SUBAGENT_PLUGIN_ID contract constant",
);
requireContract(
  /SUBAGENT_DETAIL_TOOL_ID\s*=\s*"subagent-detail"/.test(frontendSource),
  "attack-path frontend must retain SUBAGENT_DETAIL_TOOL_ID contract constant",
);
