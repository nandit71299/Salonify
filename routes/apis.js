const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer();

//Authentication Token Middleware
const authMiddleware = require("../config/authMiddleware.js")

// Validators
const saloonRegistrationData = require('../validation/saloonRegistration');
const customerLoginData = require('../validation/customerlogin.js');
const userRegistrationData = require('../validation/userRegistration');
const sendOtpData = require('../validation/sendotp');
const updatePasswordData = require('../validation/updatePassword')
const branchHours = require('../validation/branchHours')



//Controllers
const LoginController = require('../controller/loginController');
const UserController = require('../controller/userController');
const CategoryCotroller = require('../controller/categoriesController')
const BranchController = require('../controller/branchController')


// Customer Routes
router.post('/customer-login', customerLoginData.validateCustomerLogin, LoginController.login);

// Salon Routes
router.post('/saloon-registration', upload.single('image'), saloonRegistrationData.validateSalonRegistration, LoginController.register);
router.get('/categories', CategoryCotroller.getCategories);
router.post('/branch-hours', branchHours.validateBranchHours, BranchController.createBranchHours);




// Common Routes
router.post('/user-registration', userRegistrationData.validateUserRegistration, UserController.store);
router.post('/send-otp', sendOtpData.validateSendOtp, UserController.sendOtp);
router.post('/verify-user', UserController.verify);
router.post('/login', LoginController.login);
router.post('/update-password', updatePasswordData.updatePassword, LoginController.updatePassword);

module.exports = router;
