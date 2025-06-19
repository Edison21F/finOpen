const Joi = require('joi');

// Validador para registro de usuario
const validateRegister = (data) => {
  const schema = Joi.object({
    email: Joi.string()
      .email()
      .required()
      .messages({
        'string.email': 'Email must be a valid email address',
        'any.required': 'Email is required'
      }),
    
    password: Joi.string()
      .min(6)
      .max(128)
      .required()
      .messages({
        'string.min': 'Password must be at least 6 characters long',
        'string.max': 'Password must not exceed 128 characters',
        'any.required': 'Password is required'
      }),
    
    nombres: Joi.string()
      .min(2)
      .max(100)
      .required()
      .messages({
        'string.min': 'Names must be at least 2 characters long',
        'string.max': 'Names must not exceed 100 characters',
        'any.required': 'Names are required'
      }),
    
    apellidos: Joi.string()
      .min(2)
      .max(100)
      .required()
      .messages({
        'string.min': 'Last names must be at least 2 characters long',
        'string.max': 'Last names must not exceed 100 characters',
        'any.required': 'Last names are required'
      }),
    
    telefono: Joi.string()
      .pattern(/^[0-9+\-\s()]+$/)
      .min(7)
      .max(20)
      .optional()
      .messages({
        'string.pattern.base': 'Phone number contains invalid characters',
        'string.min': 'Phone number must be at least 7 characters long',
        'string.max': 'Phone number must not exceed 20 characters'
      }),
    
    fechaNacimiento: Joi.date()
      .max('now')
      .optional()
      .messages({
        'date.max': 'Birth date cannot be in the future'
      })
  });

  return schema.validate(data);
};

// Validador para login de usuario
const validateLogin = (data) => {
  const schema = Joi.object({
    email: Joi.string()
      .email()
      .required()
      .messages({
        'string.email': 'Email must be a valid email address',
        'any.required': 'Email is required'
      }),
    
    password: Joi.string()
      .required()
      .messages({
        'any.required': 'Password is required'
      })
  });

  return schema.validate(data);
};

module.exports = {
  validateRegister,
  validateLogin
};