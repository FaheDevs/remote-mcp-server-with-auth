import {
        CreateReservationSchema,
        DeleteReservationSchema,
        UpdateReservationSchema,
        type CreateReservationInput,
        type DeleteReservationInput,
        type UpdateReservationInput,
        type DatabaseOperationResult,
} from "../types";

const RESERVATIONS_ENDPOINT = "reservations";

type SupabaseRequestInit = Omit<RequestInit, "body" | "headers"> & {
        body?: unknown;
        headers?: HeadersInit;
        prefer?: string[];
};

type SupabaseConfig = {
        url: string;
        key: string;
};

function getSupabaseConfig(env: Env): SupabaseConfig {
        const url = (env as any).SUPABASE_URL as string | undefined;
        const key = (env as any).SUPABASE_SERVICE_ROLE_KEY as string | undefined;

        if (!url) {
                throw new Error("SUPABASE_URL is not configured in the worker environment");
        }

        if (!key) {
                throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured in the worker environment");
        }

        return { url: url.replace(/\/$/, ""), key };
}

async function supabaseRequest<T>(
        env: Env,
        path: string,
        init: SupabaseRequestInit
): Promise<DatabaseOperationResult<T>> {
        const start = Date.now();

        try {
                const config = getSupabaseConfig(env);
                const { prefer, body, headers, ...rest } = init;
                const url = new URL(path, `${config.url}/rest/v1/`);

                const requestHeaders = new Headers(headers ?? {});
                requestHeaders.set("apikey", config.key);
                requestHeaders.set("Authorization", `Bearer ${config.key}`);

                if (body !== undefined) {
                        requestHeaders.set("Content-Type", "application/json");
                }

                if (prefer?.length) {
                        requestHeaders.set("Prefer", prefer.join(","));
                }

                const requestInit: RequestInit = {
                        ...rest,
                        headers: requestHeaders,
                        body: body === undefined ? undefined : (JSON.stringify(body) as BodyInit),
                };

                const response = await fetch(url, requestInit);
                const duration = Date.now() - start;

                const text = await response.text();
                const hasText = text.length > 0;
                let data: any = undefined;

                if (hasText) {
                        try {
                                data = JSON.parse(text);
                        } catch (error) {
                                data = text;
                        }
                }

                if (!response.ok) {
                        const errorMessage = typeof data === "object" && data !== null ? data.message ?? response.statusText : response.statusText;

                        return {
                                success: false,
                                error: errorMessage,
                                data: typeof data === "object" && data !== null ? data : undefined,
                                duration,
                        };
                }

                return {
                        success: true,
                        data: data as T,
                        duration,
                };
        } catch (error) {
                return {
                        success: false,
                        error: error instanceof Error ? error.message : String(error),
                };
        }
}

function normalizeReservationPayload<T extends Partial<CreateReservationInput>>(payload: T): T {
        const normalized = { ...payload } as Record<string, unknown>;

        if (normalized.nb_people !== undefined) {
                normalized.nb_people = Number(normalized.nb_people);
        }

        return normalized as T;
}

export async function createReservation(
        env: Env,
        payload: CreateReservationInput
): Promise<DatabaseOperationResult<any[]>> {
        const parsedPayload = CreateReservationSchema.parse(payload);
        return supabaseRequest<any[]>(env, RESERVATIONS_ENDPOINT, {
                method: "POST",
                body: [normalizeReservationPayload(parsedPayload)],
                prefer: ["return=representation"],
        });
}

export async function updateReservation(
        env: Env,
        payload: UpdateReservationInput
): Promise<DatabaseOperationResult<any[]>> {
        const parsedPayload = UpdateReservationSchema.parse(payload);
        const { mobile, name, new_mobile, new_name, ...fields } = parsedPayload;

        const updates = Object.fromEntries(
                Object.entries(
                        normalizeReservationPayload({
                                ...fields,
                                ...(new_mobile !== undefined ? { mobile: new_mobile } : {}),
                                ...(new_name !== undefined ? { name: new_name } : {}),
                        })
                ).filter(([, value]) => value !== undefined)
        );

        const encodedMobile = encodeURIComponent(mobile);
        const encodedName = encodeURIComponent(name);

        return supabaseRequest<any[]>(
                env,
                `${RESERVATIONS_ENDPOINT}?mobile=eq.${encodedMobile}&name=eq.${encodedName}`,
                {
                        method: "PATCH",
                        body: updates,
                        prefer: ["return=representation"],
                }
        );
}

export async function deleteReservation(
        env: Env,
        payload: DeleteReservationInput
): Promise<DatabaseOperationResult<any[]>> {
        const parsedPayload = DeleteReservationSchema.parse(payload);
        const encodedMobile = encodeURIComponent(parsedPayload.mobile);
        const encodedName = encodeURIComponent(parsedPayload.name);

        return supabaseRequest<any[]>(
                env,
                `${RESERVATIONS_ENDPOINT}?mobile=eq.${encodedMobile}&name=eq.${encodedName}`,
                {
                        method: "DELETE",
                        prefer: ["return=representation"],
                }
        );
}
