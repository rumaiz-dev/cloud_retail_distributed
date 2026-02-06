const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticate, requireRole } = require('../middlewares/auth.middleware');


router.post(
  '/register',
  authController.registerValidation,
  authController.handleValidationErrors,
  authController.register
);

router.post(
  '/login',
  authController.loginValidation,
  authController.handleValidationErrors,
  authController.login
);


router.get('/profile', authenticate, authController.getProfile);
router.put('/profile', authenticate, authController.updateProfileValidation, authController.handleValidationErrors, authController.updateProfile);


router.get('/users', authenticate, requireRole('admin'), authController.getAllUsers);
router.get('/users/:id', authenticate, authController.userIdValidation, authController.handleValidationErrors, authController.getUserById);

module.exports = router;
