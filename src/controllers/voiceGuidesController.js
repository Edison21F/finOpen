const { VoiceGuide } = require('../database/database.orm');
const { asyncHandler, createError } = require('../middleware/errorHandler');
const { logAudit, logger } = require('../config/logger');

// Obtener todas las guías de voz
const getAllVoiceGuides = asyncHandler(async (req, res) => {
  const { 
    page = 1, 
    limit = 10, 
    estado, 
    language,
    quality,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = req.query;

  const offset = (page - 1) * limit;
  const query = {};

  // Filtros
  if (estado) {
    query.estado = estado;
  }

  if (language) {
    query.language = language;
  }

  if (quality) {
    query.quality = quality;
  }

  // Ordenamiento
  const sort = {};
  sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

  const voiceGuides = await VoiceGuide.find(query)
    .populate('routeId', 'name location transportName')
    .populate('messageId', 'message')
    .sort(sort)
    .skip(offset)
    .limit(parseInt(limit))
    .lean();

  const total = await VoiceGuide.countDocuments(query);

  res.json({
    success: true,
    data: {
      voiceGuides,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
});

// Obtener guía de voz por ID
const getVoiceGuideById = asyncHandler(async (req, res) => {
  const voiceGuide = await VoiceGuide.findById(req.params.id)
    .populate('routeId', 'name location transportName')
    .populate('messageId', 'message');
  
  if (!voiceGuide) {
    throw createError('Voice guide not found', 404);
  }

  res.json({
    success: true,
    data: { voiceGuide }
  });
});

// Crear nueva guía de voz
const createVoiceGuide = asyncHandler(async (req, res) => {
  const {
    routeId,
    messageId,
    mapImageUrl,
    audioUrl,
    estado = 'active',
    duration,
    language = 'es',
    quality = 'medium'
  } = req.body;

  // Validaciones básicas
  if (!routeId || !messageId || !audioUrl) {
    throw createError('Route ID, Message ID and Audio URL are required', 400);
  }

  const voiceGuide = new VoiceGuide({
    routeId,
    messageId,
    mapImageUrl,
    audioUrl,
    estado,
    duration,
    language,
    quality,
    createdBy: req.user.id
  });

  await voiceGuide.save();

  // Poblar referencias para respuesta
  await voiceGuide.populate('routeId', 'name location transportName');
  await voiceGuide.populate('messageId', 'message');

  // Log de auditoría
  logAudit('voice_guide_create', 'voice_guides', voiceGuide._id, req.user.id, {
    routeId: voiceGuide.routeId,
    messageId: voiceGuide.messageId
  });

  logger.info(`Voice guide created by user ${req.user.email}`);

  res.status(201).json({
    success: true,
    message: 'Voice guide created successfully',
    data: { voiceGuide }
  });
});

// Actualizar guía de voz
const updateVoiceGuide = asyncHandler(async (req, res) => {
  const voiceGuide = await VoiceGuide.findById(req.params.id);
  
  if (!voiceGuide) {
    throw createError('Voice guide not found', 404);
  }

  // Verificar ownership (solo el creador o admin puede modificar)
  if (voiceGuide.createdBy !== req.user.id && req.user.role !== 'admin') {
    throw createError('You can only update your own voice guides', 403);
  }

  const {
    routeId,
    messageId,
    mapImageUrl,
    audioUrl,
    estado,
    duration,
    language,
    quality
  } = req.body;

  const oldData = voiceGuide.toObject();

  // Actualizar campos
  if (routeId !== undefined) voiceGuide.routeId = routeId;
  if (messageId !== undefined) voiceGuide.messageId = messageId;
  if (mapImageUrl !== undefined) voiceGuide.mapImageUrl = mapImageUrl;
  if (audioUrl !== undefined) voiceGuide.audioUrl = audioUrl;
  if (estado !== undefined) voiceGuide.estado = estado;
  if (duration !== undefined) voiceGuide.duration = duration;
  if (language !== undefined) voiceGuide.language = language;
  if (quality !== undefined) voiceGuide.quality = quality;

  await voiceGuide.save();

  // Poblar referencias para respuesta
  await voiceGuide.populate('routeId', 'name location transportName');
  await voiceGuide.populate('messageId', 'message');

  // Log de auditoría
  logAudit('voice_guide_update', 'voice_guides', voiceGuide._id, req.user.id, {
    oldData,
    newData: voiceGuide.toObject()
  });

  logger.info(`Voice guide updated by user ${req.user.email}`);

  res.json({
    success: true,
    message: 'Voice guide updated successfully',
    data: { voiceGuide }
  });
});

// Eliminar guía de voz
const deleteVoiceGuide = asyncHandler(async (req, res) => {
  const voiceGuide = await VoiceGuide.findById(req.params.id);
  
  if (!voiceGuide) {
    throw createError('Voice guide not found', 404);
  }

  // Verificar ownership (solo el creador o admin puede eliminar)
  if (voiceGuide.createdBy !== req.user.id && req.user.role !== 'admin') {
    throw createError('You can only delete your own voice guides', 403);
  }

  await VoiceGuide.findByIdAndDelete(req.params.id);

  // Log de auditoría
  logAudit('voice_guide_delete', 'voice_guides', voiceGuide._id, req.user.id, {
    routeId: voiceGuide.routeId,
    messageId: voiceGuide.messageId
  });

  logger.info(`Voice guide deleted by user ${req.user.email}`);

  res.json({
    success: true,
    message: 'Voice guide deleted successfully'
  });
});

// Obtener guías de voz por ruta
const getVoiceGuidesByRoute = asyncHandler(async (req, res) => {
  const { routeId } = req.params;
  const { estado = 'active' } = req.query;

  const voiceGuides = await VoiceGuide.find({ 
    routeId, 
    estado 
  })
    .populate('messageId', 'message priority')
    .sort({ 'messageId.priority': -1, createdAt: -1 })
    .lean();

  res.json({
    success: true,
    data: { voiceGuides }
  });
});

// Obtener guías de voz del usuario actual
const getMyVoiceGuides = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;

  const voiceGuides = await VoiceGuide.find({ createdBy: req.user.id })
    .populate('routeId', 'name location transportName')
    .populate('messageId', 'message')
    .sort({ createdAt: -1 })
    .skip(offset)
    .limit(parseInt(limit))
    .lean();

  const total = await VoiceGuide.countDocuments({ createdBy: req.user.id });

  res.json({
    success: true,
    data: {
      voiceGuides,
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
  getAllVoiceGuides,
  getVoiceGuideById,
  createVoiceGuide,
  updateVoiceGuide,
  deleteVoiceGuide,
  getVoiceGuidesByRoute,
  getMyVoiceGuides
};