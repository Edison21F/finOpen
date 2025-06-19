const express = require('express');
const { authorize } = require('../middleware/authorization');
const {
  getAllTouristSpots,
  getTouristSpotById,
  createTouristSpot,
  updateTouristSpot,
  deleteTouristSpot,
  getNearbyTouristSpots,
  getMyTouristSpots,
  getTouristSpotsByCategory
} = require('../controllers/touristSpotsController');

const router = express.Router();

// Rutas públicas (con autenticación pero sin permisos especiales)
router.get('/', getAllTouristSpots);
router.get('/nearby', getNearbyTouristSpots);
router.get('/my-spots', getMyTouristSpots);
router.get('/category/:category', getTouristSpotsByCategory);
router.get('/:id', getTouristSpotById);

// Rutas protegidas
router.post('/', authorize(['tourist_spots.create']), createTouristSpot);
router.put('/:id', authorize(['tourist_spots.update']), updateTouristSpot);
router.delete('/:id', authorize(['tourist_spots.delete']), deleteTouristSpot);

module.exports = router;