const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer();

const saloonRegistrationData = require('../validation/saloonRegistration');
const LoginController = require('../controller/loginController');

const userRegistrationData = require('../validation/userRegistration');
const UserController = require('../controller/userController');

router.post('/login', LoginController.login);
router.post('/saloon-registration', upload.single('image'), saloonRegistrationData.validateSalonRegistration, LoginController.register);
router.post('/user-registration', userRegistrationData.validateUserRegistration, UserController.store);
router.post('/verify-user', UserController.verify);

module.exports = router;
