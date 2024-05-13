const { validationResult, check } = require('express-validator');
const logger = require('../config/logger');

exports.validateCustomerLogin = [
    check("email").trim().isEmail(),
    check("password").trim().isLength({ min: 6 }).withMessage("Invalid Password"),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            logger.error("Bad Request:", errors.array());
            return res.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
        }
        next();
    }
];
