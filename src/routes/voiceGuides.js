const express = require('express');
const { authorize } = require('../middleware/authorization');
const {
  getAllVoiceGuides,
  getVoiceGuideById,
  createVoiceGuide,
  updateVoiceGuide,
  deleteVoiceGuide,
  getVoiceGuidesByRoute,
  getMyVoiceGuides
} = require('../controllers/voiceGuidesController');

const router = express.Router();

// Rutas públicas (con autenticación pero sin permisos especiales)
router.get('/', getAllVoiceGuides);
router.get('/my-guides', getMyVoiceGuides);
router.get('/route/:routeId', getVoiceGuidesByRoute);
router.get('/:id', getVoiceGuideById);

// Rutas protegidas
router.post('/', authorize(['routes.create', 'messages.create']), createVoiceGuide);
router.put('/:id', authorize(['routes.update', 'messages.update']), updateVoiceGuide);
router.delete('/:id', authorize(['routes.delete', 'messages.delete']), deleteVoiceGuide);

module.exports = router;