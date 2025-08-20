export interface CustomError extends Error {
	statusCode?: number
	code?: number
	// errors: { [key: string]: { message: string } }
	message: string
	name: string
}
