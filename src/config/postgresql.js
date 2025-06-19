const { Sequelize, DataTypes } = require('sequelize');
const logger = require('./logger');

// Configuración de Sequelize
const sequelize = new Sequelize({
  host: process.env.PG_HOST,
  port: process.env.PG_PORT,
  database: process.env.PG_DATABASE,
  username: process.env.PG_USERNAME,
  password: process.env.PG_PASSWORD,
  dialect: 'postgres',
  logging: (msg) => logger.debug(msg),
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  define: {
    timestamps: true,
    underscored: true
  }
});

// Definir modelos
const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  passwordHash: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'password_hash'
  },
  nombres: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  apellidos: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  telefono: {
    type: DataTypes.STRING(20)
  },
  fechaNacimiento: {
    type: DataTypes.DATEONLY,
    field: 'fecha_nacimiento'
  },
  role: {
    type: DataTypes.STRING(50),
    defaultValue: 'user'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active'
  },
  emailVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'email_verified'
  },
  lastLogin: {
    type: DataTypes.DATE,
    field: 'last_login'
  }
}, {
  tableName: 'users',
  indexes: [
    { fields: ['email'] },
    { fields: ['role'] }
  ]
});

const UserSession = sequelize.define('UserSession', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'user_id'
  },
  tokenHash: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'token_hash'
  },
  ipAddress: {
    type: DataTypes.INET,
    field: 'ip_address'
  },
  userAgent: {
    type: DataTypes.TEXT,
    field: 'user_agent'
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'expires_at'
  }
}, {
  tableName: 'user_sessions',
  updatedAt: false,
  indexes: [
    { fields: ['token_hash'] },
    { fields: ['expires_at'] }
  ]
});

const Role = sequelize.define('Role', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  description: {
    type: DataTypes.TEXT
  }
}, {
  tableName: 'roles',
  updatedAt: false
});

const Permission = sequelize.define('Permission', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  description: {
    type: DataTypes.TEXT
  },
  resource: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  action: {
    type: DataTypes.STRING(100),
    allowNull: false
  }
}, {
  tableName: 'permissions',
  updatedAt: false
});

const RolePermission = sequelize.define('RolePermission', {
  roleId: {
    type: DataTypes.UUID,
    field: 'role_id'
  },
  permissionId: {
    type: DataTypes.UUID,
    field: 'permission_id'
  }
}, {
  tableName: 'role_permissions',
  timestamps: false
});

const UserRole = sequelize.define('UserRole', {
  userId: {
    type: DataTypes.UUID,
    field: 'user_id'
  },
  roleId: {
    type: DataTypes.UUID,
    field: 'role_id'
  }
}, {
  tableName: 'user_roles',
  timestamps: false
});

const AuditLog = sequelize.define('AuditLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    field: 'user_id'
  },
  action: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  resource: {
    type: DataTypes.STRING(100)
  },
  resourceId: {
    type: DataTypes.STRING,
    field: 'resource_id'
  },
  ipAddress: {
    type: DataTypes.INET,
    field: 'ip_address'
  },
  userAgent: {
    type: DataTypes.TEXT,
    field: 'user_agent'
  },
  details: {
    type: DataTypes.JSONB
  }
}, {
  tableName: 'audit_logs',
  updatedAt: false,
  indexes: [
    { fields: ['user_id'] },
    { fields: ['action'] },
    { fields: ['created_at'] }
  ]
});

// Definir asociaciones
User.hasMany(UserSession, { foreignKey: 'userId', as: 'sessions' });
UserSession.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(AuditLog, { foreignKey: 'userId', as: 'auditLogs' });
AuditLog.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Asociaciones many-to-many
User.belongsToMany(Role, { 
  through: UserRole, 
  foreignKey: 'userId',
  otherKey: 'roleId',
  as: 'roles'
});

Role.belongsToMany(User, { 
  through: UserRole, 
  foreignKey: 'roleId',
  otherKey: 'userId',
  as: 'users'
});

Role.belongsToMany(Permission, { 
  through: RolePermission, 
  foreignKey: 'roleId',
  otherKey: 'permissionId',
  as: 'permissions'
});

Permission.belongsToMany(Role, { 
  through: RolePermission, 
  foreignKey: 'permissionId',
  otherKey: 'roleId',
  as: 'roles'
});

// Función para conectar a PostgreSQL
async function connectPostgreSQL() {
  try {
    await sequelize.authenticate();
    logger.info('✅ PostgreSQL connection established successfully');
    
    // Sincronizar modelos si estamos en desarrollo
    if (process.env.NODE_ENV === 'development') {
      await sequelize.sync({ alter: true });
      logger.info('📊 PostgreSQL models synchronized');
    }
  } catch (error) {
    logger.error('❌ Unable to connect to PostgreSQL:', error);
    throw error;
  }
}

module.exports = {
  sequelize,
  connectPostgreSQL,
  User,
  UserSession,
  Role,
  Permission,
  RolePermission,
  UserRole,
  AuditLog
};