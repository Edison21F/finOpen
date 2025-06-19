const express = require('express');
const { authorize } = require('../middleware/authorization');
const {
  getAllRoutes,
  getRouteById,
  createRoute,
  updateRoute,
  deleteRoute,
  getNearbyRoutes,
  getMyRoutes
} = require('../controllers/routesController');

const router = express.Router();

// Rutas públicas (con autenticación pero sin permisos especiales)
router.get('/', getAllRoutes);
router.get('/nearby', getNearbyRoutes);
router.get('/my-routes', getMyRoutes);
router.get('/:id', getRouteById);

// Rutas protegidas
router.post('/', authorize(['routes.create']), createRoute);
router.put('/:id', authorize(['routes.update']), updateRoute);
router.delete('/:id', authorize(['routes.delete']), deleteRoute);

module.exports = router;