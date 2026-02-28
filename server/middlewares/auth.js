// server/middlewares/auth.js
import { admin } from '../config/firebase.js';

const verifyToken = async (req, res, next) => {
  try {
    // 1. Get token from cookie or Authorization header
    const token = req.cookies.__session || 
                 req.headers.authorization?.split('Bearer ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized - No token provided' });
    }

    // 2. Verify Firebase ID token
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    // 3. Attach user to request
    req.user = decodedToken;
    
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ error: 'Token expired' });
    }
    
    res.status(401).json({ error: 'Unauthorized - Invalid token' });
  }
};

const authorizeRoles = (...roles) => {
  return async (req, res, next) => {
    try {
      // Get full user data from database
      const user = await userModel.getUserById(req.user.uid);
      
      if (!user || !roles.includes(user.role)) {
        return res.status(403).json({ error: 'Forbidden - Insufficient permissions' });
      }
      
      // Attach full user data to request
      req.user = { ...req.user, ...user };
      next();
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };
};

const refreshToken = async (req, res, next) => {
   try {
      const token = req.cookies.__session;
      if (!token) return next();
      
      const decodedToken = await admin.auth().verifyIdToken(token, { checkRevoked: true });
      
      // Check if token needs refresh (expiring within 5 minutes)
      const expirationTime = decodedToken.exp * 1000;
      const currentTime = Date.now();
      const bufferTime = 5 * 60 * 1000; // 5 minutes
      
      if (expirationTime - currentTime <= bufferTime) {
        // Get fresh token from client
        const freshToken = req.headers['x-refresh-token'];
        if (!freshToken) return next();
        
        // Verify fresh token
        const freshDecodedToken = await admin.auth().verifyIdToken(freshToken);
        
        if (freshDecodedToken.uid !== decodedToken.uid) {
          throw new Error('Token refresh failed');
        }
        
        // Set new cookie
        res.cookie('__session', freshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          maxAge: 60 * 60 * 1000,
          sameSite: 'strict'
        });
        
        req.user = freshDecodedToken;
      } else {
        req.user = decodedToken;
      }
      
      next();
    } catch (error) {
      console.error('Token refresh error:', error);
      next();
  }  
};
export { verifyToken, authorizeRoles, refreshToken };