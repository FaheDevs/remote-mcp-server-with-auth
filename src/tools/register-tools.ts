import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Props } from "../types";
import { DatabaseToolsOptions, registerDatabaseTools } from "./database-tools";

export interface RegisterToolsOptions {
        database?: DatabaseToolsOptions;
}

/**
 * Register all MCP tools based on user permissions
 */
export function registerAllTools(
        server: McpServer,
        env: Env,
        props?: Props,
        options: RegisterToolsOptions = {}
) {
        // Register database tools
        registerDatabaseTools(server, env, props, options.database);

        // Future tools can be registered here
        // registerOtherTools(server, env, props);
}