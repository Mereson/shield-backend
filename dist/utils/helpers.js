export const createCustomError = (message, statusCode = 500) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    error.name = "CustomError";
    error.message = message;
    return error;
};
//# sourceMappingURL=helpers.js.map