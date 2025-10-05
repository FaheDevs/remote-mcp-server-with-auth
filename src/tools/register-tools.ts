import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DatabaseToolsOptions, registerDatabaseTools } from "./database-tools";

export interface RegisterToolsOptions {
        database?: DatabaseToolsOptions;
}

/**
 * Register all MCP tools available to this server.
 */
export function registerAllTools(
        server: McpServer,
        env: Env,
        options: RegisterToolsOptions = {}
) {
        registerDatabaseTools(server, env, options.database);
}
