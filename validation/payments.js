const { validationResult, body, check } = require('express-validator');
const logger = require('../config/logger');

exports.validateGetAllPayments = [
    check('branch_id').isNumeric().withMessage('Branch ID must be type INTEGER'),
    check('from_date').isISO8601().withMessage("Invalid Date Format"),
    check('to_date').isISO8601().withMessage("Invalid Date Fromat"),
    (request, response, next) => {
        const errors = validationResult(request);
        if (!errors.isEmpty()) {
            logger.error("Bad Request:", errors.array());
            return response.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
        }
        next();
    }
]