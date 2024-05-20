'use strict';

const express = require('express');
const router = express.Router();

const userRegistrationData = require('../app/validation/user/UserRegistrationData');
const userVerifyData = require('../app/validation/user/UserVerifyData');
const userPasswordData = require('../app/validation/user/UserPasswordData');

const userController = require('../app/http/controller/UserController');
const userService = require('../app/services/user/UserService');

const userControllerObject = new userController(new userService());

router.post(
    '/user-registration',
    userRegistrationData.validateUserRegistration(),
    userControllerObject.store.bind(userControllerObject)
);
router.post('/verify-otp', userVerifyData.validateUserVerifyOTP(), userControllerObject.verify.bind(userControllerObject));
router.get('/resend-otp', userControllerObject.resendOtp.bind(userControllerObject));
router.post('/update-password', userPasswordData.validateUserPassword(), userControllerObject.updatePassword.bind(userControllerObject));

module.exports = router;
