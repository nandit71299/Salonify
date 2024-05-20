const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer();

//Authentication Token Middleware
const authMiddleware = require("../config/authMiddleware.js");

// Validators
const saloonRegistrationData = require('../validation/saloonRegistration');
const customerLoginData = require('../validation/customerlogin.js');
const userRegistrationData = require('../validation/userRegistration');
const sendOtpData = require('../validation/sendotp');
const updatePasswordData = require('../validation/updatePassword');
const branch = require('../validation/branch');
const service = require('../validation/service');



//Controllers
const LoginController = require('../controller/loginController');
const UserController = require('../controller/userController');
const CategoryCotroller = require('../controller/categoriesController')
const BranchController = require('../controller/branchController');
const AppointmentController = require('../controller/appointmentController');
const serviceController = require('../controller/serviceController');

// Customer Routes
router.post('/customer-login', customerLoginData.validateCustomerLogin, LoginController.login);

// Salon Routes
router.post('/saloon-registration', upload.single('image'), saloonRegistrationData.validateSalonRegistration, LoginController.register);
router.get('/categories', CategoryCotroller.getCategories);

// Branch Hours
router.post('/branch-hours', branch.validateBranchHours, BranchController.createBranchHours);
router.put('/branch-hours', branch.validateBranchHours, BranchController.updateBranchHours);
router.get('/branch-hours', branch.validateGetBranchHours, BranchController.getBranchHours);

// Appointment Related
router.post('/get-branch-vacancy', AppointmentController.branchvacancy);

// Holidays
router.post('/holidays', branch.validateInsertBranchHoliday, BranchController.createHoliday);
router.delete('/holidays', branch.validateDeleteBranchHoliday, BranchController.deleteHoliday);
router.put('/holidays', branch.validateUpdateBranchHoliday, BranchController.updateHoliday);
router.get('/holidays', branch.validateGetBranchHoliday, BranchController.getHoliday);

// Services
router.post('/service', service.validateCreateService, serviceController.createService);
router.get('/services', service.validateGetAllServices, serviceController.getAllService);
router.delete('/services', service.validateDeleteServices, serviceController.deleteServices);
router.put('/service', serviceController.updateService);

// Common Routes
router.post('/user-registration', userRegistrationData.validateUserRegistration, UserController.store);
router.post('/send-otp', sendOtpData.validateSendOtp, UserController.sendOtp);
router.post('/verify-user', UserController.verify);
// router.post('/login', LoginController.login);
router.post('/update-password', updatePasswordData.updatePassword, LoginController.updatePassword);

module.exports = router;
