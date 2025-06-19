const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { User, UserSession } = require('../config/postgresql');
const { logger } = require('../config/logger');

// Middleware de autenticación
const authenticate = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token is required'
      });
    }

    // Verificar el token JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Buscar la sesión activa
    const session = await UserSession.findOne({
      where: {
        tokenHash: await bcrypt.hash(token, 10),
        expiresAt: {
          [require('sequelize').Op.gt]: new Date()
        }
      },
      include: [{
        model: User,
        as: 'user',
        where: {
          id: decoded.userId,
          isActive: true
        }
      }]
    });

    if (!session) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }

    // Actualizar último acceso
    await User.update(
      { lastLogin: new Date() },
      { where: { id: decoded.userId } }
    );

    req.user = session.user;
    req.session = session;
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }
    
    return res.status(500).json({
      success: false,
      message: 'Authentication failed'
    });
  }
};

// Middleware opcional de autenticación
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const session = await UserSession.findOne({
      where: {
        tokenHash: await bcrypt.hash(token, 10),
        expiresAt: {
          [require('sequelize').Op.gt]: new Date()
        }
      },
      include: [{
        model: User,
        as: 'user',
        where: {
          id: decoded.userId,
          isActive: true
        }
      }]
    });

    if (session) {
      req.user = session.user;
      req.session = session;
    }
    
    next();
  } catch (error) {
    // En caso de error, continuar sin autenticación
    next();
  }
};

// Generar token JWT
const generateToken = (user) => {
  return jwt.sign(
    { 
      userId: user.id,
      email: user.email,
      role: user.role
    },
    process.env.JWT_SECRET,
    { 
      expiresIn: process.env.JWT_EXPIRES_IN || '24h',
      issuer: 'openblind-api',
      audience: 'openblind-app'
    }
  );
};

// Crear sesión de usuario
const createUserSession = async (user, token, req) => {
  const tokenHash = await bcrypt.hash(token, 10);
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24); // 24 horas

  return await UserSession.create({
    userId: user.id,
    tokenHash,
    ipAddress: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    expiresAt
  });
};

// Cerrar sesión
const destroyUserSession = async (sessionId) => {
  return await UserSession.destroy({
    where: { id: sessionId }
  });
};

// Cerrar todas las sesiones de un usuario
const destroyAllUserSessions = async (userId) => {
  return await UserSession.destroy({
    where: { userId }
  });
};

// Limpiar sesiones expiradas
const cleanExpiredSessions = async () => {
  try {
    const result = await UserSession.destroy({
      where: {
        expiresAt: {
          [require('sequelize').Op.lt]: new Date()
        }
      }
    });
    
    if (result > 0) {
      logger.info(`Cleaned ${result} expired sessions`);
    }
    
    return result;
  } catch (error) {
    logger.error('Error cleaning expired sessions:', error);
    throw error;
  }
};

module.exports = {
  authenticate,
  optionalAuth,
  generateToken,
  createUserSession,
  destroyUserSession,
  destroyAllUserSessions,
  cleanExpiredSessions
};