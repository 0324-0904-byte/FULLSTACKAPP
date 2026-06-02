module.exports = (req, res, next) => {
  // verifyToken must run before this middleware so that req.user is populated
  // checks if the decoded user payload has the admin role
  if (req.user && req.user.role === 'admin') {
    next(); 
  } else {
    return res.status(403).json({ message: "Access denied. For admins only." });
  }
};