const { validationResult, check } = require('express-validator');
const logger = require('../config/logger');

exports.validateJoinPlatformCoupon = [

    check('branch_id').isNumeric().withMessage("Branch ID must be of type INTEGER."),
    check('platform_coupon_id').isNumeric().withMessage("Platform Coupon ID must be of type INTEGER."),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            logger.error("Bad Request:", errors.array());
            return res.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
        }
        next();
    }
]

exports.validateExitPlatformCoupon = [

    check('branch_id').isNumeric().withMessage("Branch ID must be of type INTEGER."),
    check('platform_coupon_id').isNumeric().withMessage("Platform Coupon ID must be of type INTEGER."),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            logger.error("Bad Request:", errors.array());
            return res.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
        }
        next();
    }

]

exports.validateGetPlatformOffers = [
    check("branch_id").isNumeric(),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            logger.error("Bad Request:", errors.array());
            return res.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
        }
        next();
    }
]

exports.validateGetPlatformOfferInsights = [
    check("branch_id").isNumeric(), check("platform_coupon_id").isNumeric(), check('from_date_range').isDate().optional(), check("to_date_range").isDate().optional(),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            logger.error("Bad Request:", errors.array());
            return res.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
        }
        next();
    }
]

exports.validateGetSalesOverTimeWithPlatformOffer = [
    check("branch_id").isNumeric(), check("platform_coupon_id").isNumeric(),
    check("from_date_range").isISO8601().isDate().optional(),
    check("to_date_range").isISO8601().isDate().optional(),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            logger.error("Bad Request:", errors.array());
            return res.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
        }
        next();
    }
]

exports.validateGetSalesByServiceWithPlatformOffer = [
    check("branch_id").isNumeric(), check("platform_coupon_id").isNumeric(), check("from_date_range").isDate().optional(), check("to_date_range").isDate().optional(),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            logger.error("Bad Request:", errors.array());
            return res.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
        }
        next();
    }
]

exports.validateGetTopPayingCustomersWithPlatformOffer = [
    check("branch_id").isNumeric(), check("platform_coupon_id").isNumeric(), check("from_date_range").isDate().optional(), check("to_date_range").isDate().optional(),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            logger.error("Bad Request:", errors.array());
            return res.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
        }
        next();
    }
]