const { validationResult, check } = require('express-validator');
const logger = require('../config/logger');

exports.validateSalonRegistration = [
    check("email").trim().isEmail(),
    check("name").trim().isString(),
    check("contact_number").trim().isMobilePhone(),
    check("description").trim().isString(),
    check("type").trim().isNumeric(),
    check("image").isBase64(),
    check("address").trim().isString(),
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
