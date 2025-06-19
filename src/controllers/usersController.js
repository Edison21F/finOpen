const { User, Role } = require('../config/postgresql');
const { asyncHandler, createError } = require('../middleware/errorHandler');
const { logAudit, logger } = require('../config/logger');
const bcrypt = require('bcryptjs');

// Obtener todos los usuarios (solo admin)
const getAllUsers = asyncHandler(async (req, res) => {
  const { 
    page = 1, 
    limit = 10, 
    search, 
    role, 
    isActive,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = req.query;

  const offset = (page - 1) * limit;
  const where = {};

  // Filtros
  if (search) {
    const { Op } = require('sequelize');
    where[Op.or] = [
      { nombres: { [Op.iLike]: `%${search}%` } },
      { apellidos: { [Op.iLike]: `%${search}%` } },
      { email: { [Op.iLike]: `%${search}%` } }
    ];
  }

  if (role) {
    where.role = role;
  }

  if (isActive !== undefined) {
    where.isActive = isActive === 'true';
  }

  const users = await User.findAndCountAll({
    where,
    attributes: { exclude: ['passwordHash'] },
    include: [{
      model: Role,
      as: 'roles',
      attributes: ['id', 'name', 'description']
    }],
    order: [[sortBy, sortOrder.toUpperCase()]],
    limit: parseInt(limit),
    offset
  });

  res.json({
    success: true,
    data: {
      users: users.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: users.count,
        pages: Math.ceil(users.count / limit)
      }
    }
  });
});

// Obtener usuario por ID
const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.params.id, {
    attributes: { exclude: ['passwordHash'] },
    include: [{
      model: Role,
      as: 'roles',
      attributes: ['id', 'name', 'description']
    }]
  });
  
  if (!user) {
    throw createError('User not found', 404);
  }

  // Solo admin o el mismo usuario puede ver los detalles
  if (req.user.role !== 'admin' && req.user.id !== user.id) {
    throw createError('Access denied', 403);
  }

  res.json({
    success: true,
    data: { user }
  });
});

// Crear nuevo usuario (solo admin)
const createUser = asyncHandler(async (req, res) => {
  const {
    email,
    password,
    nombres,
    apellidos,
    telefono,
    fechaNacimiento,
    role = 'user'
  } = req.body;

  // Validaciones básicas
  if (!email || !password || !nombres || !apellidos) {
    throw createError('Email, password, nombres and apellidos are required', 400);
  }

  // Verificar si el usuario ya existe
  const existingUser = await User.findOne({ where: { email } });
  if (existingUser) {
    throw createError('Email already exists', 409);
  }

  // Hashear la contraseña
  const passwordHash = await bcrypt.hash(password, 12);

  // Crear usuario
  const user = await User.create({
    email,
    passwordHash,
    nombres,
    apellidos,
    telefono,
    fechaNacimiento,
    role
  });

  // Log de auditoría
  logAudit('user_create_admin', 'users', user.id, req.user.id, {
    email: user.email,
    nombres: user.nombres,
    apellidos: user.apellidos,
    role: user.role
  });

  logger.info(`User created by admin: ${user.email} by ${req.user.email}`);

  // Respuesta sin contraseña
  const userResponse = await User.findByPk(user.id, {
    attributes: { exclude: ['passwordHash'] }
  });

  res.status(201).json({
    success: true,
    message: 'User created successfully',
    data: { user: userResponse }
  });
});

// Actualizar usuario
const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.params.id);
  
  if (!user) {
    throw createError('User not found', 404);
  }

  // Solo admin o el mismo usuario puede actualizar
  if (req.user.role !== 'admin' && req.user.id !== user.id) {
    throw createError('Access denied', 403);
  }

  const {
    nombres,
    apellidos,
    telefono,
    fechaNacimiento,
    role,
    isActive
  } = req.body;

  const oldData = user.toJSON();

  // Actualizar campos
  if (nombres !== undefined) user.nombres = nombres;
  if (apellidos !== undefined) user.apellidos = apellidos;
  if (telefono !== undefined) user.telefono = telefono;
  if (fechaNacimiento !== undefined) user.fechaNacimiento = fechaNacimiento;
  
  // Solo admin puede cambiar role e isActive
  if (req.user.role === 'admin') {
    if (role !== undefined) user.role = role;
    if (isActive !== undefined) user.isActive = isActive;
  }

  await user.save();

  // Log de auditoría
  logAudit('user_update', 'users', user.id, req.user.id, {
    oldData,
    newData: user.toJSON()
  });

  logger.info(`User updated: ${user.email} by ${req.user.email}`);

  // Respuesta sin contraseña
  const userResponse = await User.findByPk(user.id, {
    attributes: { exclude: ['passwordHash'] }
  });

  res.json({
    success: true,
    message: 'User updated successfully',
    data: { user: userResponse }
  });
});

// Eliminar usuario (solo admin)
const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.params.id);
  
  if (!user) {
    throw createError('User not found', 404);
  }

  // No se puede eliminar a sí mismo
  if (req.user.id === user.id) {
    throw createError('You cannot delete your own account', 400);
  }

  await user.destroy();

  // Log de auditoría
  logAudit('user_delete', 'users', user.id, req.user.id, {
    email: user.email,
    nombres: user.nombres,
    apellidos: user.apellidos
  });

  logger.info(`User deleted: ${user.email} by ${req.user.email}`);

  res.json({
    success: true,
    message: 'User deleted successfully'
  });
});

// Cambiar contraseña de usuario (solo admin)
const changeUserPassword = asyncHandler(async (req, res) => {
  const { newPassword } = req.body;

  if (!newPassword || newPassword.length < 6) {
    throw createError('New password must be at least 6 characters long', 400);
  }

  const user = await User.findByPk(req.params.id);
  
  if (!user) {
    throw createError('User not found', 404);
  }

  // Hashear nueva contraseña
  const passwordHash = await bcrypt.hash(newPassword, 12);

  // Actualizar contraseña
  await User.update(
    { passwordHash },
    { where: { id: user.id } }
  );

  // Log de auditoría
  logAudit('user_password_change_admin', 'users', user.id, req.user.id);

  logger.info(`Password changed by admin for user: ${user.email} by ${req.user.email}`);

  res.json({
    success: true,
    message: 'Password changed successfully'
  });
});

// Activar/Desactivar usuario (solo admin)
const toggleUserStatus = asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.params.id);
  
  if (!user) {
    throw createError('User not found', 404);
  }

  // No se puede desactivar a sí mismo
  if (req.user.id === user.id) {
    throw createError('You cannot deactivate your own account', 400);
  }

  const newStatus = !user.isActive;
  await User.update(
    { isActive: newStatus },
    { where: { id: user.id } }
  );

  // Log de auditoría
  logAudit('user_status_toggle', 'users', user.id, req.user.id, {
    oldStatus: user.isActive,
    newStatus
  });

  logger.info(`User ${newStatus ? 'activated' : 'deactivated'}: ${user.email} by ${req.user.email}`);

  res.json({
    success: true,
    message: `User ${newStatus ? 'activated' : 'deactivated'} successfully`,
    data: { isActive: newStatus }
  });
});

// Estadísticas de usuarios (solo admin)
const getUserStats = asyncHandler(async (req, res) => {
  const { Op } = require('sequelize');
  
  const [
    totalUsers,
    activeUsers,
    adminUsers,
    moderatorUsers,
    regularUsers,
    recentUsers
  ] = await Promise.all([
    User.count(),
    User.count({ where: { isActive: true } }),
    User.count({ where: { role: 'admin' } }),
    User.count({ where: { role: 'moderator' } }),
    User.count({ where: { role: 'user' } }),
    User.count({
      where: {
        createdAt: {
          [Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Últimos 30 días
        }
      }
    })
  ]);

  res.json({
    success: true,
    data: {
      totalUsers,
      activeUsers,
      inactiveUsers: totalUsers - activeUsers,
      adminUsers,
      moderatorUsers,
      regularUsers,
      recentUsers
    }
  });
});

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  changeUserPassword,
  toggleUserStatus,
  getUserStats
};