// src/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  // Get token from header
  const authHeader = req.header('Authorization');

  // Check if no token
  if (!authHeader) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  // Check if token format is correct (e.g., "Bearer <token>")
  const token = authHeader.split(' ')[1];
  if (!token) {
     return res.status(401).json({ message: 'Token format invalid, authorization denied' });
  }

  // Verify token
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Add user ID from payload to the request object
    req.userId = decoded.userId; 
    next();
  } catch (err) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};