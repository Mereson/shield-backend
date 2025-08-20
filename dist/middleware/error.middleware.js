const errorMiddleware = (err, req, res, next) => {
    try {
        const error = { ...err };
        error.message = err.message;
        res
            .status(error.statusCode || 500)
            .json({ success: false, error: error.message || "Server Error" });
    }
    catch (error) {
        next(error);
    }
};
export default errorMiddleware;
//# sourceMappingURL=error.middleware.js.map