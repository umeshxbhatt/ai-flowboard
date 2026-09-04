export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/* 

the above code is shorthand for the following code:

const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(
      fn(req, res, next)
    ).catch((err) => {
      next(err);
    });
  };
};

asyncHandler(async (req,res) => { // controller code })
here async (req, res) => { // controller code } is fn

asyncHandler accepts a function fn and returns new Express middleware function

Promise.resolve(fn(req, res, next))
This takes whatever fn(...) returns and turns it into a Promise as async function always returns a Promise.

.catch(next)
It means if this Promise fails, call next with the error
next is the Express function used to pass control onward

*/
