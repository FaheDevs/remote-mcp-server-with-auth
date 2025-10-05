import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
        CreateReservationParams,
        DeleteReservationParams,
        UpdateReservationParams,
        createErrorResponse,
        createSuccessResponse,
        type CreateReservationInput,
        type DeleteReservationInput,
        type UpdateReservationInput,
} from "../types";
import { createReservation, deleteReservation, updateReservation } from "./reservations-service";

export type DatabaseToolsOptions = Record<string, never>;

export function registerDatabaseTools(
        server: McpServer,
        env: Env,
        _options: DatabaseToolsOptions = {}
) {
        server.tool(
                "createReservation",
                "Create a reservation in Supabase using the guest's mobile number, name, number of people, date, time, and optional details.",
                CreateReservationParams,
                async (input: unknown) => {
                        const result = await createReservation(env, input as CreateReservationInput);

                        if (!result.success) {
                                return createErrorResponse(
                                        `Failed to create reservation: ${result.error}`,
                                        result.data
                                );
                        }

                        const created = Array.isArray(result.data) ? result.data[0] : result.data;

                        if (!created) {
                                return createErrorResponse(
                                        "Supabase returned no data after creating the reservation."
                                );
                        }

                        return createSuccessResponse(
                                `Created reservation for ${created.name ?? "guest"} on ${created.date ?? "unknown date"} at ${created.time ?? "unknown time"}.`,
                                created
                        );
                }
        );

        server.tool(
                "updateReservation",
                "Update a reservation by matching the current guest name and mobile number, then setting new details such as time, party size, or notes.",
                UpdateReservationParams,
                async (input: unknown) => {
                        const typedInput = input as UpdateReservationInput;
                        const result = await updateReservation(env, typedInput);

                        if (!result.success) {
                                return createErrorResponse(
                                        `Failed to update the reservation for ${typedInput?.name ?? "unknown guest"} (${typedInput?.mobile ?? "unknown mobile"}): ${result.error}`,
                                        result.data
                                );
                        }

                        const updated = Array.isArray(result.data) ? result.data[0] : result.data;

                        if (!updated) {
                                return createErrorResponse(
                                        `No reservation for ${typedInput?.name ?? "unknown guest"} (${typedInput?.mobile ?? "unknown mobile"}) was updated. It may not exist.`,
                                        result.data
                                );
                        }

                        const changedFields = countChangedFields(typedInput);

                        return createSuccessResponse(
                                `Updated reservation for ${updated.name ?? typedInput?.name ?? "guest"} (${updated.mobile ?? typedInput?.mobile ?? "mobile"}). ${changedFields} field${changedFields === 1 ? "" : "s"} changed.`,
                                updated
                        );
                }
        );

        server.tool(
                "deleteReservation",
                "Delete a reservation by providing the guest's name and mobile number.",
                DeleteReservationParams,
                async (input: unknown) => {
                        const typedInput = input as DeleteReservationInput;
                        const result = await deleteReservation(env, typedInput);

                        if (!result.success) {
                                return createErrorResponse(
                                        `Failed to delete the reservation for ${typedInput?.name ?? "unknown guest"} (${typedInput?.mobile ?? "unknown mobile"}): ${result.error}`,
                                        result.data
                                );
                        }

                        const deleted = Array.isArray(result.data) ? result.data[0] : result.data;

                        if (!deleted) {
                                return createErrorResponse(
                                        `No reservation for ${typedInput?.name ?? "unknown guest"} (${typedInput?.mobile ?? "unknown mobile"}) was deleted. It may not exist.`,
                                        result.data
                                );
                        }

                        return createSuccessResponse(
                                `Deleted reservation for ${deleted.name ?? typedInput?.name ?? "guest"} (${deleted.mobile ?? typedInput?.mobile ?? "mobile"}).`,
                                deleted
                        );
                }
        );
}

function countChangedFields(input: UpdateReservationInput): number {
        const ignoredKeys = new Set(["mobile", "name"]);

        return Object.entries(input)
                .filter(([key]) => !ignoredKeys.has(key))
                .filter(([, value]) => value !== undefined)
                .length;
}
