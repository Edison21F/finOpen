const { TouristSpot } = require('../../database.orm');
const { asyncHandler, createError } = require('../middleware/errorHandler');
const { logAudit, logger } = require('../config/logger');

// Obtener todos los puntos turísticos
const getAllTouristSpots = asyncHandler(async (req, res) => {
  const { 
    page = 1, 
    limit = 10, 
    search, 
    category, 
    isActive,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = req.query;

  const offset = (page - 1) * limit;
  const query = {};

  // Filtros
  if (search) {
    query.$or = [
      { lugarDestino: { $regex: search, $options: 'i' } },
      { nombre: { $regex: search, $options: 'i' } },
      { descripcion: { $regex: search, $options: 'i' } }
    ];
  }

  if (category) {
    query.category = category;
  }

  if (isActive !== undefined) {
    query.isActive = isActive === 'true';
  }

  // Ordenamiento
  const sort = {};
  sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

  const touristSpots = await TouristSpot.find(query)
    .sort(sort)
    .skip(offset)
    .limit(parseInt(limit))
    .lean();

  const total = await TouristSpot.countDocuments(query);

  res.json({
    success: true,
    data: {
      touristSpots,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
});

// Obtener punto turístico por ID
const getTouristSpotById = asyncHandler(async (req, res) => {
  const touristSpot = await TouristSpot.findById(req.params.id);
  
  if (!touristSpot) {
    throw createError('Tourist spot not found', 404);
  }

  res.json({
    success: true,
    data: { touristSpot }
  });
});

// Crear nuevo punto turístico
const createTouristSpot = asyncHandler(async (req, res) => {
  const {
    lugarDestino,
    nombre,
    descripcion,
    ubicacion,
    category = 'other',
    accessibility,
    images,
    schedule,
    contact,
    tags
  } = req.body;

  // Validaciones básicas
  if (!lugarDestino || !nombre || !descripcion) {
    throw createError('Lugar destino, nombre and descripcion are required', 400);
  }

  const touristSpot = new TouristSpot({
    lugarDestino,
    nombre,
    descripcion,
    ubicacion,
    category,
    accessibility,
    images,
    schedule,
    contact,
    tags,
    createdBy: req.user.id
  });

  await touristSpot.save();

  // Log de auditoría
  logAudit('tourist_spot_create', 'tourist_spots', touristSpot._id, req.user.id, {
    nombre: touristSpot.nombre,
    lugarDestino: touristSpot.lugarDestino
  });

  logger.info(`Tourist spot created: ${touristSpot.nombre} by user ${req.user.email}`);

  res.status(201).json({
    success: true,
    message: 'Tourist spot created successfully',
    data: { touristSpot }
  });
});

// Actualizar punto turístico
const updateTouristSpot = asyncHandler(async (req, res) => {
  const touristSpot = await TouristSpot.findById(req.params.id);
  
  if (!touristSpot) {
    throw createError('Tourist spot not found', 404);
  }

  // Verificar ownership (solo el creador o admin puede modificar)
  if (touristSpot.createdBy !== req.user.id && req.user.role !== 'admin') {
    throw createError('You can only update your own tourist spots', 403);
  }

  const {
    lugarDestino,
    nombre,
    descripcion,
    ubicacion,
    category,
    accessibility,
    images,
    schedule,
    contact,
    tags,
    isActive
  } = req.body;

  const oldData = touristSpot.toObject();

  // Actualizar campos
  if (lugarDestino !== undefined) touristSpot.lugarDestino = lugarDestino;
  if (nombre !== undefined) touristSpot.nombre = nombre;
  if (descripcion !== undefined) touristSpot.descripcion = descripcion;
  if (ubicacion !== undefined) touristSpot.ubicacion = ubicacion;
  if (category !== undefined) touristSpot.category = category;
  if (accessibility !== undefined) touristSpot.accessibility = accessibility;
  if (images !== undefined) touristSpot.images = images;
  if (schedule !== undefined) touristSpot.schedule = schedule;
  if (contact !== undefined) touristSpot.contact = contact;
  if (tags !== undefined) touristSpot.tags = tags;
  if (isActive !== undefined) touristSpot.isActive = isActive;

  await touristSpot.save();

  // Log de auditoría
  logAudit('tourist_spot_update', 'tourist_spots', touristSpot._id, req.user.id, {
    oldData,
    newData: touristSpot.toObject()
  });

  logger.info(`Tourist spot updated: ${touristSpot.nombre} by user ${req.user.email}`);

  res.json({
    success: true,
    message: 'Tourist spot updated successfully',
    data: { touristSpot }
  });
});

// Eliminar punto turístico
const deleteTouristSpot = asyncHandler(async (req, res) => {
  const touristSpot = await TouristSpot.findById(req.params.id);
  
  if (!touristSpot) {
    throw createError('Tourist spot not found', 404);
  }

  // Verificar ownership (solo el creador o admin puede eliminar)
  if (touristSpot.createdBy !== req.user.id && req.user.role !== 'admin') {
    throw createError('You can only delete your own tourist spots', 403);
  }

  await TouristSpot.findByIdAndDelete(req.params.id);

  // Log de auditoría
  logAudit('tourist_spot_delete', 'tourist_spots', touristSpot._id, req.user.id, {
    nombre: touristSpot.nombre,
    lugarDestino: touristSpot.lugarDestino
  });

  logger.info(`Tourist spot deleted: ${touristSpot.nombre} by user ${req.user.email}`);

  res.json({
    success: true,
    message: 'Tourist spot deleted successfully'
  });
});

// Buscar puntos turísticos cerca de una ubicación
const getNearbyTouristSpots = asyncHandler(async (req, res) => {
  const { latitude, longitude, maxDistance = 1000 } = req.query;

  if (!latitude || !longitude) {
    throw createError('Latitude and longitude are required', 400);
  }

  const touristSpots = await TouristSpot.find({
    ubicacion: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [parseFloat(longitude), parseFloat(latitude)]
        },
        $maxDistance: parseInt(maxDistance)
      }
    },
    isActive: true
  }).lean();

  // Calcular distancia para cada punto
  const spotsWithDistance = touristSpots.map(spot => {
    const distance = spot.calculateDistance ? 
      spot.calculateDistance(parseFloat(latitude), parseFloat(longitude)) : 
      null;
    
    return {
      ...spot,
      distance: distance ? `${distance.toFixed(2)} km` : null
    };
  });

  res.json({
    success: true,
    data: { touristSpots: spotsWithDistance }
  });
});

// Obtener puntos turísticos del usuario actual
const getMyTouristSpots = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;

  const touristSpots = await TouristSpot.find({ createdBy: req.user.id })
    .sort({ createdAt: -1 })
    .skip(offset)
    .limit(parseInt(limit))
    .lean();

  const total = await TouristSpot.countDocuments({ createdBy: req.user.id });

  res.json({
    success: true,
    data: {
      touristSpots,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
});

// Obtener puntos turísticos por categoría
const getTouristSpotsByCategory = asyncHandler(async (req, res) => {
  const { category } = req.params;
  const { page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;

  const touristSpots = await TouristSpot.find({ 
    category, 
    isActive: true 
  })
    .sort({ 'rating.average': -1 })
    .skip(offset)
    .limit(parseInt(limit))
    .lean();

  const total = await TouristSpot.countDocuments({ category, isActive: true });

  res.json({
    success: true,
    data: {
      touristSpots,
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
  getAllTouristSpots,
  getTouristSpotById,
  createTouristSpot,
  updateTouristSpot,
  deleteTouristSpot,
  getNearbyTouristSpots,
  getMyTouristSpots,
  getTouristSpotsByCategory
};