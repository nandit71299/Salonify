const { validationResult, body, check } = require('express-validator');
const logger = require('../config/logger');

exports.validateGetAllBranchOffers = [
    check('branch_id').isNumeric().withMessage('Branch ID must be type INTEGER'),
    (request, response, next) => {
        const errors = validationResult(request);
        if (!errors.isEmpty()) {
            logger.error("Bad Request:", errors.array());
            return response.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
        }
        next();
    }
]

exports.validateCreateOffer = [
    check('remark').isString(),
    check('branch_id').isNumeric().withMessage('Branch ID must be type INTEGER'),
    check('discount_amount')
        .isNumeric().withMessage('Discount must be a number')
        .isFloat({ min: 0, max: 100 }).withMessage('Discount must be between 0 and 100'),
    check('minimum_order_subtotal').isNumeric().withMessage('Minimum Order Subtotal must be a number'),
    check('name').isString('Invalid Coupon Name'),
    check('from_date').isDate(),
    check('to_date').isDate(),
    check('coupon_status').isNumeric().isInt({ min: 0, max: 1 }).withMessage('Coupon Status Must Be 0 OR 1'),
    check('advance_percentage').isNumeric().isFloat({ min: 0, max: 100 }),
    check('max_advance_amount').isNumeric().isFloat(),
    (request, response, next) => {
        const errors = validationResult(request);
        if (!errors.isEmpty()) {
            logger.error("Bad Request:", errors.array());
            return response.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
        }
        next();
    }
]



exports.validategetBranchOfferDetails = [
    check('id').isNumeric().withMessage('ID must be type INTEGER'),
    check('branch_id').isNumeric().withMessage('Branch ID must be type INTEGER'),
    (request, response, next) => {
        const errors = validationResult(request);
        if (!errors.isEmpty()) {
            logger.error("Bad Request:", errors.array());
            return response.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
        }
        next();
    }
]
