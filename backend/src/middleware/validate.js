import { ZodError } from "zod";

// this function takes the zod schema as argunment and returns a standard middleware function ((req, res, next))
export const validate = (schema) => (req, res, next) => {
  // We start a try...catch block. Because Zod's .parse() method throws an error if the validation fails, we need to catch it so our server doesn't crash.
  try {
    // Validate request body, query, and params against the provided schema
    schema.parse({
      body: req.body,
      query: req.query,
      params: req.params,
    });
    next(); // Valid! Proceed to the controller
  } catch (error) {
    // We use instanceof ZodError to check: "Was this error thrown by Zod because the data was bad?"
    if (error instanceof ZodError) {
      const firstError = error.errors[0]?.message || "Validation Error";
      return res.status(400).json({
        success: false,
        error: firstError,
        message: firstError,
        errors: error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }))
      });
    }
    // If the error was not a ZodError (maybe your server ran out of memory, or something else crashed entirely), we pass the error to Express's global error handler by calling next(error).
    next(error);
  }
};
