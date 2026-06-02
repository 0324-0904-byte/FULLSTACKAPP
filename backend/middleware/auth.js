// imports jsonwebtoken to verify tokens
const jwt = require("jsonwebtoken");

// imports the config to get the JWT secret
const env = require("../config/db.config");

// middleware function — runs before the actual route handler
// this is the same pattern as express.json() and cors() — a middleware
module.exports = (req, res, next) => {
  // reads the Authorization header from the request
  // expected format: "Bearer <token>"
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  // if no token is found, reject the request
  if (!token) return res.status(401).json({ message: "No token provided" });

  // verifies the token using the secret key
  jwt.verify(token, env.JWT_SECRET, (err, decoded) => {
    if (err)
      return res.status(403).json({ message: "Invalid or expired token" });

    // attaches the decoded user info to req.user so routes can use it
    req.user = decoded;
    next(); // passes control to the next middleware or route handler
  });
};
