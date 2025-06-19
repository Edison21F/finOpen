const express = require('express');
const { authorize, requireRole } = require('../middleware/authorization');
const {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  changeUserPassword,
  toggleUserStatus,
  getUserStats
} = require('../controllers/usersController');

const router = express.Router();

// Rutas que requieren permisos de admin
router.get('/', requireRole('admin'), getAllUsers);
router.get('/stats', requireRole('admin'), getUserStats);
router.post('/', requireRole('admin'), authorize(['users.create']), createUser);
router.put('/:id/password', requireRole('admin'), authorize(['users.update']), changeUserPassword);
router.patch('/:id/toggle-status', requireRole('admin'), authorize(['users.update']), toggleUserStatus);
router.delete('/:id', requireRole('admin'), authorize(['users.delete']), deleteUser);

// Rutas que pueden usar usuarios normales (para ver/editar su propio perfil)
router.get('/:id', authorize(['users.read']), getUserById);
router.put('/:id', authorize(['users.update']), updateUser);

module.exports = router;