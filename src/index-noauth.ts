import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAllTools } from "./tools/register-tools";

/**
 * Lightweight MCP server variant that exposes the database tools without requiring
 * any authentication. This is useful for local development or trusted environments
 * where GitHub OAuth is not yet configured.
 */
class NoAuthDatabaseMCP extends McpAgent<Env, Record<string, never>, Record<string, never>> {
        server = new McpServer({
                name: "PostgreSQL Database MCP Server (No Auth)",
                version: "1.0.0",
        });

        async init() {
                registerAllTools(this.server, this.env);
        }
}

export const NoAuthMCP = NoAuthDatabaseMCP;

export default {
        fetch(request: Request, env: Env, ctx: ExecutionContext) {
                const url = new URL(request.url);

                if (url.pathname === "/sse" || url.pathname === "/sse/message") {
                        return NoAuthDatabaseMCP.serveSSE("/sse").fetch(request, env, ctx);
                }

                if (url.pathname === "/mcp") {
                        return NoAuthDatabaseMCP.serve("/mcp").fetch(request, env, ctx);
                }

                return new Response("Not found", { status: 404 });
        },
};
