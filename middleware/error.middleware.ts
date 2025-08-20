import { NextFunction, Request, Response } from "express"
import { CustomError } from "../utils/services.js"

const errorMiddleware = (
	err: CustomError,
	req: Request,
	res: Response,
	next: NextFunction
): void => {
	try {
		const error = { ...err }
		error.message = err.message

		res
			.status(error.statusCode || 500)
			.json({ success: false, error: error.message || "Server Error" })
	} catch (error) {
		next(error)
	}
}

export default errorMiddleware
