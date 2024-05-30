const { validationResult, check } = require('express-validator');
const logger = require('../config/logger');

exports.validateCustomerLogin = [
    check("email").trim().isEmail(),
    check('password')
        .isStrongPassword()
        .withMessage('Password must be at least 8 characters long, and contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            logger.error("Bad Request:", errors.array());
            return res.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
        }
        next();
    }
];

exports.validateVerifyUser = [
    check("email").trim().isEmail(),
    check('otp').isNumeric(),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            logger.error("Bad Request:", errors.array());
            return res.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
        }
        next();
    }

]

exports.validateSalonRegistration = [
    check("email").trim().isEmail(),
    check("name").trim().isString(),
    check("contact_number").trim().isMobilePhone(),
    check("description").trim().isString(),
    check("type").trim().isNumeric(),
    check("address").trim().isString(),
    check('password')
        .isStrongPassword()
        .withMessage('Password must be at least 8 characters long, and contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
    check("image").custom((value, { req }) => {
        if (!req.file) {
            throw new Error('Image is required');
        }
        return true;
    }),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            logger.error("Bad Request:", errors.array());
            return res.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
        }
        next();
    }
];


exports.validateCustomerRegistration = [
    check("name").trim().isString(),
    check("email").trim().isEmail(),
    check("fname").trim().notEmpty(),
    check("lname").trim().notEmpty(),
    check("phone_number").trim().isMobilePhone(),
    check("dob").trim().isDate({ format: 'DD-MM-YYYY' }).optional(),
    check('password')
        .isStrongPassword()
        .withMessage('Password must be at least 8 characters long, and contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
    (request, response, next) => {
        const errors = validationResult(request);
        if (!errors.isEmpty()) {
            logger.error("Bad Request:", errors.array());
            return response.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
        }
        next();
    }
];

exports.validateSendOtp = [
    check("email").trim().isEmail(),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            logger.error("Bad Request:", errors.array());
            return res.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
        }
        next();
    }
];

exports.updatePassword = [
    check("email").trim().isEmail(),
    check("otp").trim().isNumeric(),
    check('password')
        .isStrongPassword()
        .withMessage('Password must be at least 8 characters long, and contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
    (request, response, next) => {
        const errors = validationResult(request);
        if (!errors.isEmpty()) {
            logger.error("Bad Request:", errors.array());
            return response.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
        }
        next();
    }
];

exports.validateSalonLogin = [

    check("email").isEmail(),
    check('password')
        .isStrongPassword()
        .withMessage('Password must be at least 8 characters long, and contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
    (request, response, next) => {
        const errors = validationResult(request);
        if (!errors.isEmpty()) {
            logger.error("Bad Request:", errors.array());
            return response.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
        }
        next();
    }
]