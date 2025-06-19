const express = require('express');
const { authorize } = require('../middleware/authorization');
const {
  getAllMessages,
  getMessageById,
  createMessage,
  updateMessage,
  deleteMessage,
  getNearbyMessages,
  getMyMessages
} = require('../controllers/messagesController');

const router = express.Router();

// Rutas públicas (con autenticación pero sin permisos especiales)
router.get('/', getAllMessages);
router.get('/nearby', getNearbyMessages);
router.get('/my-messages', getMyMessages);
router.get('/:id', getMessageById);

// Rutas protegidas
router.post('/', authorize(['messages.create']), createMessage);
router.put('/:id', authorize(['messages.update']), updateMessage);
router.delete('/:id', authorize(['messages.delete']), deleteMessage);

module.exports = router;