import { google } from "@ai-sdk/google"
export interface CustomError extends Error {
	statusCode?: number
	code?: number
	// errors: { [key: string]: { message: string } }
	message: string
	name: string
}

export const mainModel = google("gemini-2.0-flash")