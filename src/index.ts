import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAllTools } from "./tools/register-tools";

/**
 * Primary MCP worker entrypoint that exposes the reservation tools without
 * any authentication layer. This keeps deployment simple while still using
 * Durable Objects to host the MCP server.
 */
export class ReservationsMCP extends McpAgent<Env, Record<string, never>, Record<string, never>> {
        server = new McpServer({
                name: "Supabase Reservations MCP Server",
                version: "1.0.0",
        });

        async init() {
                registerAllTools(this.server, this.env);
        }
}

export default {
        fetch(request: Request, env: Env, ctx: ExecutionContext) {
                const url = new URL(request.url);

                if (url.pathname === "/sse" || url.pathname === "/sse/message") {
                        return ReservationsMCP.serveSSE("/sse").fetch(request, env, ctx);
                }

                if (url.pathname === "/mcp") {
                        return ReservationsMCP.serve("/mcp").fetch(request, env, ctx);
                }

                return new Response("Not found", { status: 404 });
        },
};
