import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export async function verifyToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authorization required. Please log in.' });
    }

    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET || 'hometech_super_secure_jwt_secret_key_2026_987654321';
    const decoded = jwt.verify(token, secret);

    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({ message: 'User account not found.' });
    }
    if (!user.isActive) {
      return res.status(403).json({ message: 'Your account has been deactivated. Please contact support.' });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Session expired. Please log in again.' });
    }
    return res.status(401).json({ message: 'Invalid authentication token.' });
  }
}

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required.' });
    }
    const hasRole = req.user.roles.some((r) => allowedRoles.includes(r));
    if (!hasRole) {
      return res.status(403).json({
        message: `Forbidden: Access requires one of the following roles: [${allowedRoles.join(', ')}]`
      });
    }
    next();
  };
}

export function requireAdmin(req, res, next) {
  if (!req.user || !req.user.roles.includes('admin')) {
    return res.status(403).json({ message: 'Administrative privileges required.' });
  }
  next();
}

export function requireApprovedWorker(req, res, next) {
  if (!req.user || !req.user.roles.includes('worker') || req.user.workerStatus !== 'approved') {
    return res.status(403).json({ message: 'Access requires an approved worker account.' });
  }
  next();
}
