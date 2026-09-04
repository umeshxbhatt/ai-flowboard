// Custom API error class to handle different HTTP status codes and messages

class ApiError extends Error {
  // Makes ApiError a custom version of JavaScript's built-in Error
  constructor(statusCode, message) {
    super(message); // Calls the parent Error constructor and sets the error message
    this.statusCode = statusCode; // Stores the HTTP status code in the error object
    this.isApiError = true; // A boolean flag (true) that identifies this as a custom API error
  }

  // These methods make creating common HTTP errors easy
  // static methods are called on the class itself
  static badRequest(msg) {
    return new ApiError(400, msg);
  }
  static unauthorized(msg = "Unauthorized") {
    return new ApiError(401, msg);
  }
  static forbidden(msg = "Forbidden") {
    return new ApiError(403, msg);
  }
  static notFound(msg = "Not found") {
    return new ApiError(404, msg);
  }
  static conflict(msg) {
    return new ApiError(409, msg);
  }
}

export default ApiError;
