const { Route } = require('../../database.orm');
const { asyncHandler, createError } = require('../middleware/errorHandler');
const { logAudit, logger } = require('../config/logger');

// Obtener todas las rutas
const getAllRoutes = asyncHandler(async (req, res) => {
  const { 
    page = 1, 
    limit = 10, 
    search, 
    isActive, 
    difficulty,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = req.query;

  const offset = (page - 1) * limit;
  const query = {};

  // Filtros
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { location: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }

  if (isActive !== undefined) {
    query.isActive = isActive === 'true';
  }

  if (difficulty) {
    query.difficulty = difficulty;
  }

  // Ordenamiento
  const sort = {};
  sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

  const routes = await Route.find(query)
    .sort(sort)
    .skip(offset)
    .limit(parseInt(limit))
    .lean();

  const total = await Route.countDocuments(query);

  res.json({
    success: true,
    data: {
      routes,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
});

// Obtener ruta por ID
const getRouteById = asyncHandler(async (req, res) => {
  const route = await Route.findById(req.params.id);
  
  if (!route) {
    throw createError('Route not found', 404);
  }

  res.json({
    success: true,
    data: { route }
  });
});

// Crear nueva ruta
const createRoute = asyncHandler(async (req, res) => {
  const {
    name,
    location,
    transportName,
    description,
    coordinates,
    beacons,
    tags,
    difficulty
  } = req.body;

  // Validaciones básicas
  if (!name || !location || !transportName) {
    throw createError('Name, location and transport name are required', 400);
  }

  const route = new Route({
    name,
    location,
    transportName,
    description,
    coordinates,
    beacons,
    tags,
    difficulty,
    createdBy: req.user.id
  });

  await route.save();

  // Log de auditoría
  logAudit('route_create', 'routes', route._id, req.user.id, {
    name: route.name,
    location: route.location
  });

  logger.info(`Route created: ${route.name} by user ${req.user.email}`);

  res.status(201).json({
    success: true,
    message: 'Route created successfully',
    data: { route }
  });
});

// Actualizar ruta
const updateRoute = asyncHandler(async (req, res) => {
  const route = await Route.findById(req.params.id);
  
  if (!route) {
    throw createError('Route not found', 404);
  }

  // Verificar ownership (solo el creador o admin puede modificar)
  if (route.createdBy !== req.user.id && req.user.role !== 'admin') {
    throw createError('You can only update your own routes', 403);
  }

  const {
    name,
    location,
    transportName,
    description,
    coordinates,
    beacons,
    tags,
    difficulty,
    isActive
  } = req.body;

  const oldData = route.toObject();

  // Actualizar campos
  if (name !== undefined) route.name = name;
  if (location !== undefined) route.location = location;
  if (transportName !== undefined) route.transportName = transportName;
  if (description !== undefined) route.description = description;
  if (coordinates !== undefined) route.coordinates = coordinates;
  if (beacons !== undefined) route.beacons = beacons;
  if (tags !== undefined) route.tags = tags;
  if (difficulty !== undefined) route.difficulty = difficulty;
  if (isActive !== undefined) route.isActive = isActive;

  await route.save();

  // Log de auditoría
  logAudit('route_update', 'routes', route._id, req.user.id, {
    oldData,
    newData: route.toObject()
  });

  logger.info(`Route updated: ${route.name} by user ${req.user.email}`);

  res.json({
    success: true,
    message: 'Route updated successfully',
    data: { route }
  });
});

// Eliminar ruta
const deleteRoute = asyncHandler(async (req, res) => {
  const route = await Route.findById(req.params.id);
  
  if (!route) {
    throw createError('Route not found', 404);
  }

  // Verificar ownership (solo el creador o admin puede eliminar)
  if (route.createdBy !== req.user.id && req.user.role !== 'admin') {
    throw createError('You can only delete your own routes', 403);
  }

  await Route.findByIdAndDelete(req.params.id);

  // Log de auditoría
  logAudit('route_delete', 'routes', route._id, req.user.id, {
    name: route.name,
    location: route.location
  });

  logger.info(`Route deleted: ${route.name} by user ${req.user.email}`);

  res.json({
    success: true,
    message: 'Route deleted successfully'
  });
});

// Buscar rutas cerca de una ubicación
const getNearbyRoutes = asyncHandler(async (req, res) => {
  const { latitude, longitude, maxDistance = 1000 } = req.query;

  if (!latitude || !longitude) {
    throw createError('Latitude and longitude are required', 400);
  }

  const routes = await Route.find({
    coordinates: {
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

  res.json({
    success: true,
    data: { routes }
  });
});

// Obtener rutas del usuario actual
const getMyRoutes = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;

  const routes = await Route.find({ createdBy: req.user.id })
    .sort({ createdAt: -1 })
    .skip(offset)
    .limit(parseInt(limit))
    .lean();

  const total = await Route.countDocuments({ createdBy: req.user.id });

  res.json({
    success: true,
    data: {
      routes,
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
  getAllRoutes,
  getRouteById,
  createRoute,
  updateRoute,
  deleteRoute,
  getNearbyRoutes,
  getMyRoutes
};