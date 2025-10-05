import { z } from "zod";

// MCP tool schemas for reservation management
const mobileField = z
  .string()
  .min(1, "Mobile number is required")
  .describe("Customer mobile phone number, including country code if applicable.");

const nameField = z
  .string()
  .min(1, "Name is required")
  .describe("Full name of the guest who made the reservation.");

const nbPeopleField = z
  .coerce.number()
  .int("The number of people must be an integer")
  .min(1, "At least one person must be included in the reservation")
  .describe("Number of guests included in the reservation.");

const emailField = z
  .string()
  .email("Please provide a valid email address")
  .describe("Contact email address for the reservation.")
  .optional();

const dateField = z
  .string()
  .min(1, "Reservation date is required")
  .describe("Reservation date in YYYY-MM-DD format.");

const timeField = z
  .string()
  .min(1, "Reservation time is required")
  .describe("Reservation time in HH:MM format (24-hour clock).");

const notesField = z
  .string()
  .max(2000, "Notes should be 2000 characters or fewer")
  .describe("Additional notes or special requests for the reservation.")
  .optional();

export const CreateReservationSchema = z.object({
  mobile: mobileField,
  name: nameField,
  nb_people: nbPeopleField,
  date: dateField,
  time: timeField,
  email: emailField,
  notes: notesField,
});

export const CreateReservationParams = CreateReservationSchema.shape;

const updateOnlyFields = {
  new_mobile: mobileField.optional().describe(
    "New mobile number to store for the reservation."
  ),
  new_name: nameField.optional().describe(
    "New guest name to store for the reservation."
  ),
  nb_people: nbPeopleField.optional(),
  email: emailField,
  date: dateField.optional(),
  time: timeField.optional(),
  notes: notesField,
};

const UpdateReservationBase = z.object({
  mobile: mobileField.describe(
    "Current mobile number on the reservation you want to update."
  ),
  name: nameField.describe(
    "Current guest name on the reservation you want to update."
  ),
  ...updateOnlyFields,
});

export const UpdateReservationSchema = UpdateReservationBase.refine(
  (data) =>
    Object.keys(updateOnlyFields).some(
      (key) => (data as Record<string, unknown>)[key] !== undefined
    ),
  {
    message:
      "Provide at least one field to update (new contact info, date, time, etc.).",
    path: ["mobile"],
  }
);

export const UpdateReservationParams = UpdateReservationBase.shape;

export const DeleteReservationSchema = z.object({
  mobile: mobileField.describe(
    "Mobile number stored on the reservation you want to remove."
  ),
  name: nameField.describe(
    "Guest name stored on the reservation you want to remove."
  ),
});

export const DeleteReservationParams = DeleteReservationSchema.shape;

export type CreateReservationInput = z.infer<typeof CreateReservationSchema>;
export type UpdateReservationInput = z.infer<typeof UpdateReservationSchema>;
export type DeleteReservationInput = z.infer<typeof DeleteReservationSchema>;

// MCP response types
export interface McpTextContent {
  [key: string]: unknown;
  type: "text";
  text: string;
  isError?: boolean;
}

export interface McpResponse {
  [key: string]: unknown;
  content: McpTextContent[];
}

// Standard response creators
export function createSuccessResponse(message: string, data?: any): McpResponse {
  let text = `**Success**\n\n${message}`;
  if (data !== undefined) {
    text += `\n\n**Result:**\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``;
  }
  return {
    content: [{
      type: "text",
      text,
    }],
  };
}

export function createErrorResponse(message: string, details?: any): McpResponse {
  let text = `**Error**\n\n${message}`;
  if (details !== undefined) {
    text += `\n\n**Details:**\n\`\`\`json\n${JSON.stringify(details, null, 2)}\n\`\`\``;
  }
  return {
    content: [{
      type: "text",
      text,
      isError: true,
    }],
  };
}

// Database operation result type
export interface DatabaseOperationResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  duration?: number;
}

// SQL validation result
export interface SqlValidationResult {
  isValid: boolean;
  error?: string;
}
