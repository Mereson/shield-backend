import { CustomError } from "./services.js"

export const createCustomError = (
	message: string,
	statusCode: number = 500
): CustomError => {
	const error = new Error(message) as CustomError
	error.statusCode = statusCode
	error.name = "CustomError"
	error.message = message
	return error
}
