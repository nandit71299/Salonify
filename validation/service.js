const { validationResult, check, body } = require('express-validator');
const logger = require('../config/logger');

exports.validateCreateService = [
    body().isObject(),
    body("service_name").trim().isString(),
    body("branch_id").trim().isInt(),
    body("category_id").trim().isInt(),
    body("description").trim().isString(),
    body("additional_information").isArray(),
    body("additional_information.*.title").trim().isString(),
    body("additional_information.*.description").trim().isString(),
    body("service_options").isArray(),
    body("service_options.*.name").trim().isString(),
    body("service_options.*.discount").trim().isInt(),
    body("service_options.*.price").trim().isInt(),
    body("service_options.*.description").trim().isString(),
    body("service_options.*.duration").trim().isInt(),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            logger.error("Bad Request:", errors.array());
            return res.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
        }
        next();
    }
]

exports.validateGetAllServices = [
    check('branch_id').trim().isNumeric().withMessage('Branch ID must be numeric'),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            logger.error("Bad Request:", errors.array());
            return res.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
        }
        next();
    }
]


exports.validateDeleteServices = [

    check('branch_id').trim().isNumeric().withMessage('Branch ID must be numeric'),
    check('service_ids').isArray().withMessage('Service must be of type array'),
    // check('service_ids.*').isNumeric().withMessage('Service ID must be numeric'),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            logger.error("Bad Request:", errors.array());
            return res.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
        }
        next();
    }
]

exports.validateGetService = [

    check("branch_id").trim().isNumeric().withMessage("Branch ID must be numeric"),
    check("service_id").trim().isNumeric().withMessage("Service ID must be numeric"),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            logger.error("Bad Request:", errors.array());
            return res.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
        }
        next();
    }

]

exports.validateUpdateService = [
    body().isObject(),
    body('service_id').trim().isInt(),
    body("service_name").optional().trim().isString(),
    body("branch_id").optional().trim().isInt(),
    body("category_id").optional().trim().isInt(),
    body("description").optional().trim().isString(),
    body("additional_information").optional().isArray(),
    body("additional_information.*.id").optional().trim().isNumeric(),
    body("additional_information.*.title").optional().trim().isString(),
    body("additional_information.*.description").optional().trim().isString(),
    body("service_options").optional().isArray(),
    body("service_options.*.name").optional().trim().isString(),
    body("service_options.*.discount").optional().trim().isInt(),
    body("service_options.*.price").optional().trim().isInt(),
    body("service_options.*.description").optional().trim().isString(),
    body("service_options.*.duration").optional().trim().isInt(),
    check("branch_id").trim().isNumeric().withMessage("Branch ID must be numeric"),
    check("service_id").trim().isNumeric().withMessage("Service ID must be numeric"),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            logger.error("Bad Request:", errors.array());
            return res.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
        }
        next();
    }
]