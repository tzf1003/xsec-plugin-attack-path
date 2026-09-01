#!/usr/bin/env node

const readline = require("node:readline");

const tools = [
  ["attack_path_node_create", "Create an attack-path node"],
  ["attack_path_node_update", "Update an attack-path node"],
  ["attack_path_node_get", "Read an attack-path node"],
  ["attack_path_list", "List attack-path nodes"],
  ["attack_path_finding_add", "Attach a finding to an attack-path node"],
];

function response(id, result, error) {
  return JSON.stringify({ jsonrpc: "2.0", id, ...(error ? { error } : { result }) });
}

function toolDescriptors() {
  return tools.map(([name, description]) => ({
    name,
    description,
    inputSchema: inputSchemaFor(name),
  }));
}

function inputSchemaFor(name) {
  const schemas = {
    attack_path_node_create: {
      properties: { parent_id: { type: "string" }, title: { type: "string" }, kind: { type: "string" }, target: { type: "string" }, test_value: { type: "string" }, brief: { type: "string" } },
      required: ["title"],
    },
    attack_path_node_update: {
      properties: { node_id: { type: "string" }, status: { type: "string" }, test_value: { type: "string" }, conclusion: { type: "string" }, subagent_id: { type: "string" }, expected_revision: { type: "integer" } },
      required: ["node_id"],
    },
    attack_path_node_get: { properties: { node_id: { type: "string" } }, required: ["node_id"] },
    attack_path_finding_add: { properties: { node_id: { type: "string" }, fingerprint: { type: "string" }, kind: { type: "string" }, severity: { type: "string" }, title: { type: "string" }, data: { type: "object" } }, required: ["fingerprint", "title"] },
    attack_path_list: { properties: {} },
  };
  return { type: "object", additionalProperties: true, ...(schemas[name] || {}) };
}

async function hostCall(method, params) {
  const endpoint = process.env.XSEC_ATTACK_PATH_HOST_RPC;
  if (!endpoint) throw new Error("XSEC_ATTACK_PATH_HOST_RPC is not configured");
  const token = process.env.XSEC_ATTACK_PATH_HOST_TOKEN;
  if (!token) throw new Error("XSEC_ATTACK_PATH_HOST_TOKEN is not configured");
  const headers = { "content-type": "application/json" };
  headers.authorization = `Bearer ${token}`;
  const result = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
  });
  if (!result.ok) throw new Error(`XSec Host RPC failed: HTTP ${result.status}`);
  const payload = await result.json();
  if (payload.error) throw new Error(payload.error.message || "XSec Host RPC error");
  return payload.result;
}

async function dispatch(request) {
  if (request.method === "initialize") {
    return { protocolVersion: "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "xsec-attack-path", version: "1.0.0" } };
  }
  if (request.method === "notifications/initialized") return null;
  if (request.method === "tools/list") return { tools: toolDescriptors() };
  if (request.method !== "tools/call") throw new Error(`unsupported MCP method: ${request.method}`);
  const name = request.params?.name;
  const args = request.params?.arguments;
  if (!tools.some(([tool]) => tool === name)) throw new Error(`unknown attack-path tool: ${name}`);
  if (!args || typeof args !== "object" || Array.isArray(args)) throw new Error("tool arguments must be an object");
  const result = await hostCall(`xsec.attack-path.${name}`, args);
  return { content: [{ type: "text", text: JSON.stringify(result ?? {}) }], structuredContent: result ?? {} };
}

const input = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
input.on("line", async (line) => {
  if (!line.trim()) return;
  let request;
  try {
    request = JSON.parse(line);
    const result = await dispatch(request);
    if (request.id !== undefined) process.stdout.write(`${response(request.id, result)}\n`);
  } catch (error) {
    if (request?.id !== undefined) process.stdout.write(`${response(request.id, null, { code: -32000, message: String(error.message || error) })}\n`);
  }
});
