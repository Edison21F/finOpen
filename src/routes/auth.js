const express = require('express');
const bcrypt = require('bcryptjs');
const { User } = require('../config/postgresql');
const { 
  generateToken, 
  createUserSession, 
  destroyUserSession,
  authenticate 
} = require('../middleware/auth');
const { asyncHandler, createError } = require('../middleware/errorHandler');
const { logAudit, logger } = require('../config/logger');
const { validateRegister, validateLogin } = require('../validators/authValidator');

const router = express.Router();

// Registro de usuario
router.post('/register', asyncHandler(async (req, res) => {
  // Validar datos de entrada
  const { error, value } = validateRegister(req.body);
  if (error) {
    throw createError(error.details[0].message, 400);
  }

  const { 
    email, 
    password, 
    nombres, 
    apellidos, 
    telefono, 
    fechaNacimiento 
  } = value;

  // Verificar si el usuario ya existe
  const existingUser = await User.findOne({ where: { email } });
  if (existingUser) {
    throw createError('Email already registered', 409);
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
    role: 'user'
  });

  // Log de auditoría
  logAudit('user_register', 'users', user.id, user.id, {
    email: user.email,
    nombres: user.nombres,
    apellidos: user.apellidos
  });

  logger.info(`New user registered: ${user.email}`);

  // Generar token
  const token = generateToken(user);
  const session = await createUserSession(user, token, req);

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: {
      user: {
        id: user.id,
        email: user.email,
        nombres: user.nombres,
        apellidos: user.apellidos,
        telefono: user.telefono,
        fechaNacimiento: user.fechaNacimiento,
        role: user.role,
        createdAt: user.createdAt
      },
      token,
      expiresAt: session.expiresAt
    }
  });
}));

// Login de usuario
router.post('/login', asyncHandler(async (req, res) => {
  // Validar datos de entrada
  const { error, value } = validateLogin(req.body);
  if (error) {
    throw createError(error.details[0].message, 400);
  }

  const { email, password } = value;

  // Buscar usuario
  const user = await User.findOne({ where: { email, isActive: true } });
  if (!user) {
    throw createError('Invalid credentials', 401);
  }

  // Verificar contraseña
  const isValidPassword = await bcrypt.compare(password, user.passwordHash);
  if (!isValidPassword) {
    throw createError('Invalid credentials', 401);
  }

  // Generar token y crear sesión
  const token = generateToken(user);
  const session = await createUserSession(user, token, req);

  // Actualizar último login
  await User.update(
    { lastLogin: new Date() },
    { where: { id: user.id } }
  );

  // Log de auditoría
  logAudit('user_login', 'users', user.id, user.id, {
    email: user.email,
    ip: req.ip
  });

  logger.info(`User logged in: ${user.email}`);

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      user: {
        id: user.id,
        email: user.email,
        nombres: user.nombres,
        apellidos: user.apellidos,
        telefono: user.telefono,
        fechaNacimiento: user.fechaNacimiento,
        role: user.role,
        lastLogin: user.lastLogin
      },
      token,
      expiresAt: session.expiresAt
    }
  });
}));

// Logout de usuario
router.post('/logout', authenticate, asyncHandler(async (req, res) => {
  await destroyUserSession(req.session.id);

  // Log de auditoría
  logAudit('user_logout', 'users', req.user.id, req.user.id, {
    sessionId: req.session.id
  });

  logger.info(`User logged out: ${req.user.email}`);

  res.json({
    success: true,
    message: 'Logout successful'
  });
}));

// Obtener perfil del usuario actual
router.get('/profile', authenticate, asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.user.id, {
    attributes: { exclude: ['passwordHash'] }
  });

  res.json({
    success: true,
    data: { user }
  });
}));

// Actualizar perfil del usuario actual
router.put('/profile', authenticate, asyncHandler(async (req, res) => {
  const { nombres, apellidos, telefono, fechaNacimiento } = req.body;

  const [updatedRowsCount] = await User.update(
    { nombres, apellidos, telefono, fechaNacimiento },
    { 
      where: { id: req.user.id },
      returning: true 
    }
  );

  if (updatedRowsCount === 0) {
    throw createError('User not found', 404);
  }

  const updatedUser = await User.findByPk(req.user.id, {
    attributes: { exclude: ['passwordHash'] }
  });

  // Log de auditoría
  logAudit('user_profile_update', 'users', req.user.id, req.user.id, {
    changes: { nombres, apellidos, telefono, fechaNacimiento }
  });

  res.json({
    success: true,
    message: 'Profile updated successfully',
    data: { user: updatedUser }
  });
}));

// Cambiar contraseña
router.put('/change-password', authenticate, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw createError('Current password and new password are required', 400);
  }

  if (newPassword.length < 6) {
    throw createError('New password must be at least 6 characters long', 400);
  }

  const user = await User.findByPk(req.user.id);
  
  // Verificar contraseña actual
  const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isValidPassword) {
    throw createError('Current password is incorrect', 400);
  }

  // Hashear nueva contraseña
  const newPasswordHash = await bcrypt.hash(newPassword, 12);

  // Actualizar contraseña
  await User.update(
    { passwordHash: newPasswordHash },
    { where: { id: req.user.id } }
  );

  // Log de auditoría
  logAudit('user_password_change', 'users', req.user.id, req.user.id);

  logger.info(`Password changed for user: ${req.user.email}`);

  res.json({
    success: true,
    message: 'Password changed successfully'
  });
}));

// Verificar token (para validar sesión)
router.get('/verify', authenticate, asyncHandler(async (req, res) => {
  res.json({
    success: true,
    message: 'Token is valid',
    data: {
      user: {
        id: req.user.id,
        email: req.user.email,
        nombres: req.user.nombres,
        apellidos: req.user.apellidos,
        role: req.user.role
      }
    }
  });
}));

module.exports = router;