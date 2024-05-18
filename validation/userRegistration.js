const { validationResult, check } = require('express-validator');
const logger = require('../config/logger');

exports.validateUserRegistration = [
    check("name").trim().isString(),
    check("email").trim().isEmail(),
    check("fname").trim().notEmpty(),
    check("lname").trim().notEmpty(),
    check("phone_number").trim().isMobilePhone(),
    check("dob").trim().isDate({ format: 'DD-MM-YYYY' }),
    (request, response, next) => {
        const errors = validationResult(request);
        if (!errors.isEmpty()) {
            logger.error("Bad Request:", errors.array());
            return response.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
        }
        next();
    }
];
