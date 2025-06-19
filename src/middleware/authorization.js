const { Role, Permission } = require('../config/postgresql');
const { logger } = require('../config/logger');

// Cache para permisos (en producción usar Redis)
const permissionsCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

// Obtener permisos de usuario con cache
const getUserPermissions = async (userId) => {
  const cacheKey = `user_permissions_${userId}`;
  const cached = permissionsCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.permissions;
  }

  try {
    const user = await require('../config/postgresql').User.findByPk(userId, {
      include: [{
        model: Role,
        as: 'roles',
        include: [{
          model: Permission,
          as: 'permissions'
        }]
      }]
    });

    if (!user) {
      return [];
    }

    // Recopilar todos los permisos de todos los roles
    const permissions = [];
    user.roles.forEach(role => {
      role.permissions.forEach(permission => {
        if (!permissions.find(p => p.id === permission.id)) {
          permissions.push({
            id: permission.id,
            name: permission.name,
            resource: permission.resource,
            action: permission.action
          });
        }
      });
    });

    // Guardar en cache
    permissionsCache.set(cacheKey, {
      permissions,
      timestamp: Date.now()
    });

    return permissions;
  } catch (error) {
    logger.error('Error getting user permissions:', error);
    return [];
  }
};

// Middleware de autorización por permisos
const authorize = (requiredPermissions) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      // Super admin siempre tiene acceso
      if (req.user.role === 'admin') {
        return next();
      }

      const userPermissions = await getUserPermissions(req.user.id);
      
      // Verificar si tiene los permisos requeridos
      const hasPermission = requiredPermissions.every(required => {
        return userPermissions.some(permission => {
          if (typeof required === 'string') {
            return permission.name === required;
          }
          
          if (typeof required === 'object') {
            return permission.resource === required.resource && 
                   permission.action === required.action;
          }
          
          return false;
        });
      });

      if (!hasPermission) {
        logger.warn(`Access denied for user ${req.user.id}`, {
          requiredPermissions,
          userPermissions: userPermissions.map(p => p.name)
        });

        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions'
        });
      }

      next();
    } catch (error) {
      logger.error('Authorization error:', error);
      return res.status(500).json({
        success: false,
        message: 'Authorization failed'
      });
    }
  };
};

// Middleware de autorización por roles
const requireRole = (roles) => {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];
  
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn(`Role access denied for user ${req.user.id}`, {
        userRole: req.user.role,
        requiredRoles: allowedRoles
      });

      return res.status(403).json({
        success: false,
        message: 'Insufficient role permissions'
      });
    }

    next();
  };
};

// Middleware para verificar ownership de recursos
const requireOwnership = (getResourceUserId) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      // Super admin siempre tiene acceso
      if (req.user.role === 'admin') {
        return next();
      }

      const resourceUserId = await getResourceUserId(req);
      
      if (resourceUserId !== req.user.id) {
        logger.warn(`Ownership access denied for user ${req.user.id}`, {
          resourceUserId,
          requestedBy: req.user.id
        });

        return res.status(403).json({
          success: false,
          message: 'Access denied: You can only access your own resources'
        });
      }

      next();
    } catch (error) {
      logger.error('Ownership verification error:', error);
      return res.status(500).json({
        success: false,
        message: 'Access verification failed'
      });
    }
  };
};

// Verificar si el usuario tiene un permiso específico
const hasPermission = async (userId, resource, action) => {
  try {
    const permissions = await getUserPermissions(userId);
    return permissions.some(permission => 
      permission.resource === resource && permission.action === action
    );
  } catch (error) {
    logger.error('Error checking permission:', error);
    return false;
  }
};

// Limpiar cache de permisos
const clearPermissionsCache = (userId = null) => {
  if (userId) {
    permissionsCache.delete(`user_permissions_${userId}`);
  } else {
    permissionsCache.clear();
  }
};

// Middleware combinado para verificar múltiples condiciones
const requireAny = (...middlewares) => {
  return async (req, res, next) => {
    let lastError = null;
    
    for (const middleware of middlewares) {
      try {
        await new Promise((resolve, reject) => {
          middleware(req, res, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        
        // Si llegamos aquí, el middleware pasó
        return next();
      } catch (error) {
        lastError = error;
        continue;
      }
    }
    
    // Si ningún middleware pasó, usar el último error
    if (lastError) {
      throw lastError;
    }
    
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  };
};

module.exports = {
  authorize,
  requireRole,
  requireOwnership,
  hasPermission,
  getUserPermissions,
  clearPermissionsCache,
  requireAny
};