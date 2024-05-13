const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer();

const saloonRegistrationData = require('../validation/saloonRegistration');
const customerLogin = require('../validation/customerlogin.js');
const LoginController = require('../controller/loginController');
const branchRegistration = require('../validation/branchRegistration.js')

const userRegistrationData = require('../validation/userRegistration');
const UserController = require('../controller/userController');
const { validateBranchRegistration } = require('../validation/branchRegistration.js');
const branchController = require('../controller/branchController.js');

router.post('/login', LoginController.login);
router.post('/saloon-registration', upload.single('image'), saloonRegistrationData.validateSalonRegistration, LoginController.register);
router.post('/user-registration', userRegistrationData.validateUserRegistration, UserController.store);
router.post('/verify-user', UserController.verify);
router.post('/customerlogin', customerLogin.validateCustomerLogin, LoginController.login);
router.post('/testbranchregistration', branchRegistration.validateBranchRegistration, branchController.test);

module.exports = router;
