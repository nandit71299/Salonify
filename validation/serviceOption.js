const { validationResult, check, body } = require('express-validator');
const logger = require('../config/logger');

exports.validateDeleteServiceOption = [
    check("option_id").isInt().customSanitizer(value => parseInt(value)),
    check("branch_id").isInt(),
    (request, response, next) => {
        const errors = validationResult(request);
        if (!errors.isEmpty()) {
            logger.error("Bad Request:", errors.array());
            return response.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
        }
        next();
    }
]