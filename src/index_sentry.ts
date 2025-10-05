import * as Sentry from "@sentry/cloudflare";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { closeDb } from "./database/connection";
import { registerDatabaseToolsWithSentry } from "./tools/database-tools-sentry";

function getSentryConfig(env: Env) {
        return {
                dsn: (env as any).SENTRY_DSN,
                tracesSampleRate: 1,
        };
}

export class ReservationsMCPWithSentry extends McpAgent<
        Env,
        Record<string, never>,
        Record<string, never>
> {
        server = new McpServer({
                name: "Supabase Reservations MCP Server",
                version: "1.0.0",
        });

        async cleanup(): Promise<void> {
                try {
                        await closeDb();
                        console.log("Database connections closed successfully");
                } catch (error) {
                        console.error("Error during database cleanup:", error);
                }
        }

        async alarm(): Promise<void> {
                await this.cleanup();
        }

        async init() {
                        const sentryConfig = getSentryConfig(this.env);
                        if (sentryConfig.dsn) {
                                // @ts-expect-error Sentry.init is available at runtime
                                Sentry.init(sentryConfig);
                        }

                registerDatabaseToolsWithSentry(this.server, this.env);
        }
}

export default {
        fetch(request: Request, env: Env, ctx: ExecutionContext) {
                const url = new URL(request.url);

                if (url.pathname === "/sse" || url.pathname === "/sse/message") {
                        return ReservationsMCPWithSentry.serveSSE("/sse").fetch(request, env, ctx);
                }

                if (url.pathname === "/mcp") {
                        return ReservationsMCPWithSentry.serve("/mcp").fetch(request, env, ctx);
                }

                return new Response("Not found", { status: 404 });
        },
};
