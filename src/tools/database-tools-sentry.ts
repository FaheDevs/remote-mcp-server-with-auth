import * as Sentry from "@sentry/cloudflare";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
        Props,
        CreateReservationParams,
        DeleteReservationParams,
        UpdateReservationParams,
        createErrorResponse,
        createSuccessResponse,
        type McpResponse,
        type CreateReservationInput,
        type DeleteReservationInput,
        type UpdateReservationInput,
} from "../types";
import { createReservation, deleteReservation, updateReservation } from "./reservations-service";

export function registerDatabaseToolsWithSentry(server: McpServer, env: Env, props: Props) {
        server.tool(
                "createReservation",
                "Create a reservation in Supabase using the guest's mobile number, name, number of people, date, time, and optional details.",
                CreateReservationParams,
                async (input) =>
                        runWithSentrySpan("createReservation", props, async () => {
                                const result = await createReservation(env, input as CreateReservationInput);

                                if (!result.success) {
                                        return sentryErrorResponse(
                                                `Failed to create reservation: ${result.error}`,
                                                result.data
                                        );
                                }

                                const created = Array.isArray(result.data) ? result.data[0] : result.data;

                                if (!created) {
                                        return sentryErrorResponse(
                                                "Supabase returned no data after creating the reservation."
                                        );
                                }

                                return createSuccessResponse(
                                        `Created reservation for ${created.name ?? "guest"} on ${created.date ?? "unknown date"} at ${created.time ?? "unknown time"}.`,
                                        created
                                );
                        })
        );

        server.tool(
                "updateReservation",
                "Update a reservation by matching the current guest name and mobile number, then setting new details such as time, party size, or notes.",
                UpdateReservationParams,
                async (input) =>
                        runWithSentrySpan("updateReservation", props, async () => {
                                const result = await updateReservation(env, input as UpdateReservationInput);

                                if (!result.success) {
                                        return sentryErrorResponse(
                                                `Failed to update the reservation for ${input?.name ?? "unknown guest"} (${input?.mobile ?? "unknown mobile"}): ${result.error}`,
                                                result.data
                                        );
                                }

                                const updated = Array.isArray(result.data) ? result.data[0] : result.data;

                                if (!updated) {
                                        return sentryErrorResponse(
                                                `No reservation for ${input?.name ?? "unknown guest"} (${input?.mobile ?? "unknown mobile"}) was updated. It may not exist.`,
                                                result.data
                                        );
                                }

                                const changedFields = countChangedFields(input as UpdateReservationInput);

                                return createSuccessResponse(
                                        `Updated reservation for ${updated.name ?? input?.name ?? "guest"} (${updated.mobile ?? input?.mobile ?? "mobile"}). ${changedFields} field${changedFields === 1 ? "" : "s"} changed.`,
                                        updated
                                );
                        })
        );

        server.tool(
                "deleteReservation",
                "Delete a reservation by providing the guest's name and mobile number.",
                DeleteReservationParams,
                async (input) =>
                        runWithSentrySpan("deleteReservation", props, async () => {
                                const result = await deleteReservation(env, input as DeleteReservationInput);

                                if (!result.success) {
                                        return sentryErrorResponse(
                                                `Failed to delete the reservation for ${input?.name ?? "unknown guest"} (${input?.mobile ?? "unknown mobile"}): ${result.error}`,
                                                result.data
                                        );
                                }

                                const deleted = Array.isArray(result.data) ? result.data[0] : result.data;

                                if (!deleted) {
                                        return sentryErrorResponse(
                                                `No reservation for ${input?.name ?? "unknown guest"} (${input?.mobile ?? "unknown mobile"}) was deleted. It may not exist.`,
                                                result.data
                                        );
                                }

                                return createSuccessResponse(
                                        `Deleted reservation for ${deleted.name ?? input?.name ?? "guest"} (${deleted.mobile ?? input?.mobile ?? "mobile"}).`,
                                        deleted
                                );
                        })
        );
}

async function runWithSentrySpan(
        toolName: string,
        props: Props,
        handler: () => Promise<McpResponse>
) {
        return Sentry.startNewTrace(async () => {
                return Sentry.startSpan(
                        {
                                name: `mcp.tool/${toolName}`,
                                attributes: {
                                        "mcp.tool.name": toolName,
                                        "mcp.user.login": props.login,
                                },
                        },
                        async (span) => {
                                Sentry.setUser({
                                        username: props.login,
                                        email: props.email,
                                });

                                try {
                                        const response = await handler();
                                        return response;
                                } catch (error) {
                                        return sentryErrorResponse(error);
                                } finally {
                                        span.end();
                                }
                        }
                );
        });
}

function sentryErrorResponse(message: unknown, details?: unknown) {
        const eventId = Sentry.captureException(
                message instanceof Error ? message : new Error(String(message))
        );

        if (typeof message === "string") {
                return createErrorResponse(`${message}\n\n**Event ID:** ${eventId}`, details);
        }

        const text = message instanceof Error ? message.message : String(message);
        return createErrorResponse(`Unexpected error: ${text}\n\n**Event ID:** ${eventId}`, details);
}

function countChangedFields(input: UpdateReservationInput): number {
        const ignoredKeys = new Set(["mobile", "name"]);

        return Object.entries(input)
                .filter(([key]) => !ignoredKeys.has(key))
                .filter(([, value]) => value !== undefined)
                .length;
}
