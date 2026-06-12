import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { toMcpErrorResult } from "./toolResult.js";
import type { AuditLog } from "@vel/core";

export interface VelServerOptions {
  name: string;
  version: string;
}

export interface VelToolExample {
  description: string;
  input: Record<string, unknown>;
}

export interface VelToolSpec<TInput extends z.ZodRawShape = z.ZodRawShape> {
  name: string;
  title?: string;
  description: string;
  inputSchema: TInput;
  examples?: VelToolExample[];
  outputSchema?: z.ZodRawShape;
  handler: (input: z.infer<z.ZodObject<TInput>>) => Promise<unknown>;
}

export function createVelServer(options: VelServerOptions): McpServer {
  return new McpServer({ name: options.name, version: options.version });
}

export interface VelToolRegistrationOptions {
  auditLog?: AuditLog;
  serverPackage?: string;
}

export function registerVelTool<TInput extends z.ZodRawShape>(
  server: McpServer,
  spec: VelToolSpec<TInput>,
  opts: VelToolRegistrationOptions = {}
): void {
  validateToolName(spec.name);
  validateDescription(spec.name, spec.description);

  const sdkServer = server as unknown as {
    registerTool?: (name: string, meta: unknown, handler: (input: unknown) => Promise<unknown>) => void;
    tool?: (name: string, descriptionOrSchema: unknown, schemaOrHandler: unknown, maybeHandler?: unknown) => void;
  };

  const pkg = opts.serverPackage ?? spec.name.split(".")[0];
  const audit = opts.auditLog;

  const safeHandler = async (input: unknown) => {
    const started = Date.now();

    try {
      const parsed = z.object(spec.inputSchema).parse(input);
      const result = await spec.handler(parsed as z.infer<z.ZodObject<TInput>>);

      void audit?.append({
        type: "tool_call",
        package: pkg,
        operation: spec.name,
        metadata: { durationMs: Date.now() - started, outcome: "success", input: redactInput(input) }
      });
      return result;
    } catch (error) {
      void audit?.append({
        type: "tool_call",
        package: pkg,
        operation: spec.name,
        metadata: { durationMs: Date.now() - started, outcome: "error", errorMessage: String(error) }
      });
      return toMcpErrorResult(error);
    }
  };

  const meta: Record<string, unknown> = {
    title: spec.title,
    description: spec.description,
    inputSchema: spec.inputSchema
  };
  if (spec.examples) {
    meta.examples = spec.examples;
  }
  if (spec.outputSchema) {
    meta.outputSchema = spec.outputSchema;
  }

  if (typeof sdkServer.registerTool === "function") {
    sdkServer.registerTool(spec.name, meta, safeHandler);
    return;
  }

  if (typeof sdkServer.tool === "function") {
    sdkServer.tool(spec.name, spec.description, spec.inputSchema, safeHandler);
    return;
  }

  throw new Error("Unsupported MCP SDK server shape: no registerTool/tool method found");
}

export async function connectStdio(server: McpServer): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

export function validateToolName(name: string): void {
  if (!/^[a-z][a-z0-9_-]*\.[a-z][a-z0-9_-]*$/.test(name)) {
    throw new Error(`Invalid VEL tool name: ${name}. Expected module.action`);
  }
  if (name.length > 128) throw new Error(`Tool name too long: ${name}`);
}

export function validateDescription(toolName: string, description: string): void {
  if (description.length > 800) {
    throw new Error(`Tool ${toolName} description is too long (${description.length}/800 chars)`);
  }
}

function redactInput(input: unknown): unknown {
  if (!input || typeof input !== "object") return input;
  const copy = { ...input as Record<string, unknown> };
  if ("image" in copy) {
    const img = copy.image as Record<string, unknown> | undefined;
    if (img?.kind === "data_url") {
      copy.image = { ...img, value: "<redacted: data_url>" };
    }
  }
  return copy;
}
