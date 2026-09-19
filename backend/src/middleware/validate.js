import { ZodError } from "zod";

export const validate = (schema) => (req, res, next) => {
  try {
    // Validate request body, query, and params against the provided schema
    schema.parse({
      body: req.body,
      query: req.query,
      params: req.params,
    });
    next(); // Valid! Proceed to the controller
  } catch (error) {
    if (error instanceof ZodError) {
      // If validation fails, return 400 Bad Request with formatted error messages
      return res.status(400).json({
        success: false,
        message: "Validation Error",
        errors: error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }))
      });
    }
    next(error); // Pass any other internal errors to the error handler
  }
};
