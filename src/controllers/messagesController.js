const { PersonalizedMessage } = require('../../database.orm');
const { asyncHandler, createError } = require('../middleware/errorHandler');
const { logAudit, logger } = require('../config/logger');

// Obtener todos los mensajes personalizados
const getAllMessages = asyncHandler(async (req, res) => {
  const { 
    page = 1, 
    limit = 10, 
    search, 
    estado, 
    routeId,
    touristSpotId,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = req.query;

  const offset = (page - 1) * limit;
  const query = {};

  // Filtros
  if (search) {
    query.message = { $regex: search, $options: 'i' };
  }

  if (estado) {
    query.estado = estado;
  }

  if (routeId) {
    query.routeId = routeId;
  }

  if (touristSpotId) {
    query.touristSpotId = touristSpotId;
  }

  // Ordenamiento
  const sort = {};
  sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

  const messages = await PersonalizedMessage.find(query)
    .populate('routeId', 'name location')
    .populate('touristSpotId', 'nombre lugarDestino')
    .sort(sort)
    .skip(offset)
    .limit(parseInt(limit))
    .lean();

  const total = await PersonalizedMessage.countDocuments(query);

  res.json({
    success: true,
    data: {
      messages,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
});

// Obtener mensaje por ID
const getMessageById = asyncHandler(async (req, res) => {
  const message = await PersonalizedMessage.findById(req.params.id)
    .populate('routeId', 'name location')
    .populate('touristSpotId', 'nombre lugarDestino');
  
  if (!message) {
    throw createError('Message not found', 404);
  }

  res.json({
    success: true,
    data: { message }
  });
});

// Crear nuevo mensaje personalizado
const createMessage = asyncHandler(async (req, res) => {
  const {
    message,
    estado = 'active',
    routeId,
    touristSpotId,
    coordinates,
    triggerRadius,
    language = 'es',
    audioUrl,
    priority = 1
  } = req.body;

  // Validaciones básicas
  if (!message) {
    throw createError('Message content is required', 400);
  }

  if (!routeId && !touristSpotId && !coordinates) {
    throw createError('Message must be associated with a route, tourist spot, or coordinates', 400);
  }

  const newMessage = new PersonalizedMessage({
    message,
    estado,
    routeId,
    touristSpotId,
    coordinates,
    triggerRadius,
    language,
    audioUrl,
    priority,
    createdBy: req.user.id
  });

  await newMessage.save();

  // Log de auditoría
  logAudit('message_create', 'messages', newMessage._id, req.user.id, {
    message: newMessage.message,
    estado: newMessage.estado
  });

  logger.info(`Message created by user ${req.user.email}`);

  res.status(201).json({
    success: true,
    message: 'Personalized message created successfully',
    data: { message: newMessage }
  });
});

// Actualizar mensaje
const updateMessage = asyncHandler(async (req, res) => {
  const messageDoc = await PersonalizedMessage.findById(req.params.id);
  
  if (!messageDoc) {
    throw createError('Message not found', 404);
  }

  // Verificar ownership (solo el creador o admin puede modificar)
  if (messageDoc.createdBy !== req.user.id && req.user.role !== 'admin') {
    throw createError('You can only update your own messages', 403);
  }

  const {
    message,
    estado,
    routeId,
    touristSpotId,
    coordinates,
    triggerRadius,
    language,
    audioUrl,
    priority
  } = req.body;

  const oldData = messageDoc.toObject();

  // Actualizar campos
  if (message !== undefined) messageDoc.message = message;
  if (estado !== undefined) messageDoc.estado = estado;
  if (routeId !== undefined) messageDoc.routeId = routeId;
  if (touristSpotId !== undefined) messageDoc.touristSpotId = touristSpotId;
  if (coordinates !== undefined) messageDoc.coordinates = coordinates;
  if (triggerRadius !== undefined) messageDoc.triggerRadius = triggerRadius;
  if (language !== undefined) messageDoc.language = language;
  if (audioUrl !== undefined) messageDoc.audioUrl = audioUrl;
  if (priority !== undefined) messageDoc.priority = priority;

  await messageDoc.save();

  // Log de auditoría
  logAudit('message_update', 'messages', messageDoc._id, req.user.id, {
    oldData,
    newData: messageDoc.toObject()
  });

  logger.info(`Message updated by user ${req.user.email}`);

  res.json({
    success: true,
    message: 'Message updated successfully',
    data: { message: messageDoc }
  });
});

// Eliminar mensaje
const deleteMessage = asyncHandler(async (req, res) => {
  const messageDoc = await PersonalizedMessage.findById(req.params.id);
  
  if (!messageDoc) {
    throw createError('Message not found', 404);
  }

  // Verificar ownership (solo el creador o admin puede eliminar)
  if (messageDoc.createdBy !== req.user.id && req.user.role !== 'admin') {
    throw createError('You can only delete your own messages', 403);
  }

  await PersonalizedMessage.findByIdAndDelete(req.params.id);

  // Log de auditoría
  logAudit('message_delete', 'messages', messageDoc._id, req.user.id, {
    message: messageDoc.message
  });

  logger.info(`Message deleted by user ${req.user.email}`);

  res.json({
    success: true,
    message: 'Message deleted successfully'
  });
});

// Obtener mensajes cerca de una ubicación
const getNearbyMessages = asyncHandler(async (req, res) => {
  const { latitude, longitude, maxDistance = 100 } = req.query;

  if (!latitude || !longitude) {
    throw createError('Latitude and longitude are required', 400);
  }

  const messages = await PersonalizedMessage.find({
    coordinates: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [parseFloat(longitude), parseFloat(latitude)]
        },
        $maxDistance: parseInt(maxDistance)
      }
    },
    estado: 'active'
  })
  .populate('routeId', 'name location')
  .populate('touristSpotId', 'nombre lugarDestino')
  .sort({ priority: -1 })
  .lean();

  res.json({
    success: true,
    data: { messages }
  });
});

// Obtener mensajes del usuario actual
const getMyMessages = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;

  const messages = await PersonalizedMessage.find({ createdBy: req.user.id })
    .populate('routeId', 'name location')
    .populate('touristSpotId', 'nombre lugarDestino')
    .sort({ createdAt: -1 })
    .skip(offset)
    .limit(parseInt(limit))
    .lean();

  const total = await PersonalizedMessage.countDocuments({ createdBy: req.user.id });

  res.json({
    success: true,
    data: {
      messages,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
});

module.exports = {
  getAllMessages,
  getMessageById,
  createMessage,
  updateMessage,
  deleteMessage,
  getNearbyMessages,
  getMyMessages
};