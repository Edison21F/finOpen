const { logger } = require('../config/logger');
const { ValidationError } = require('joi');

// Middleware de manejo de errores
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log del error
  logger.error('Error Handler:', {
    error: error.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userId: req.user?.id
  });

  // Error de validación de Joi
  if (err instanceof ValidationError) {
    const message = err.details.map(detail => detail.message).join(', ');
    error = {
      statusCode: 400,
      message: `Validation Error: ${message}`
    };
  }

  // Error de Sequelize - Validación
  if (err.name === 'SequelizeValidationError') {
    const message = err.errors.map(error => error.message).join(', ');
    error = {
      statusCode: 400,
      message: `Validation Error: ${message}`
    };
  }

  // Error de Sequelize - Unique constraint
  if (err.name === 'SequelizeUniqueConstraintError') {
    const field = err.errors[0]?.path || 'field';
    error = {
      statusCode: 409,
      message: `${field} already exists`
    };
  }

  // Error de Sequelize - Foreign key constraint
  if (err.name === 'SequelizeForeignKeyConstraintError') {
    error = {
      statusCode: 400,
      message: 'Invalid reference to related resource'
    };
  }

  // Error de MongoDB - Validation
  if (err.name === 'ValidationError' && err.errors) {
    const message = Object.values(err.errors).map(error => error.message).join(', ');
    error = {
      statusCode: 400,
      message: `Validation Error: ${message}`
    };
  }

  // Error de MongoDB - Duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    error = {
      statusCode: 409,
      message: `${field} already exists`
    };
  }

  // Error de MongoDB - Cast
  if (err.name === 'CastError') {
    error = {
      statusCode: 400,
      message: 'Invalid resource ID format'
    };
  }

  // JWT Errors
  if (err.name === 'JsonWebTokenError') {
    error = {
      statusCode: 401,
      message: 'Invalid authentication token'
    };
  }

  if (err.name === 'TokenExpiredError') {
    error = {
      statusCode: 401,
      message: 'Authentication token expired'
    };
  }

  // Error de rate limiting
  if (err.statusCode === 429) {
    error = {
      statusCode: 429,
      message: 'Too many requests, please try again later'
    };
  }

  // Error de multer (file upload)
  if (err.code === 'LIMIT_FILE_SIZE') {
    error = {
      statusCode: 413,
      message: 'File size too large'
    };
  }

  if (err.code === 'LIMIT_FILE_COUNT') {
    error = {
      statusCode: 413,
      message: 'Too many files'
    };
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    error = {
      statusCode: 400,
      message: 'Unexpected file field'
    };
  }

  // Error genérico de servidor
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal Server Error';

  // En producción, no mostrar detalles del error interno
  const response = {
    success: false,
    message: message
  };

  // En desarrollo, incluir más detalles
  if (process.env.NODE_ENV === 'development') {
    response.error = err.message;
    response.stack = err.stack;
  }

  // Errores críticos (500) requieren atención inmediata
  if (statusCode >= 500) {
    logger.error('CRITICAL ERROR', {
      message: err.message,
      stack: err.stack,
      url: req.originalUrl,
      method: req.method,
      body: req.body,
      params: req.params,
      query: req.query,
      userId: req.user?.id,
      timestamp: new Date().toISOString()
    });
  }

  res.status(statusCode).json(response);
};

// Middleware para rutas no encontradas
const notFound = (req, res, next) => {
  const error = new Error(`Route not found - ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

// Función para crear errores personalizados
const createError = (message, statusCode = 500, details = {}) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.details = details;
  return error;
};

// Función para manejar promesas async sin try-catch
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
  errorHandler,
  notFound,
  createError,
  asyncHandler
};