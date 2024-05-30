const { validationResult, check, body } = require('express-validator');
const logger = require('../config/logger');

exports.validateCreateService = [
    body().isObject(),
    body("service_name").trim().isString(),
    body("branch_id").trim().isNumeric(),
    body("category_id").trim().isNumeric(),
    body("department_id").trim().isNumeric(),
    body("description").trim().isString(),
    body("additional_information").isArray(),
    body("additional_information.*.title").trim().isString(),
    body("additional_information.*.description").trim().isString(),
    body("service_options").isArray(),
    body("service_options.*.name").trim().isString(),
    body("service_options.*.discount").trim().isNumeric(),
    body("service_options.*.price").trim().isNumeric(),
    body("service_options.*.description").trim().isString(),
    body("service_options.*.duration").trim().isNumeric(),
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
    body('service_id').trim().isNumeric(),
    body("service_name").optional().trim().isString(),
    body("branch_id").optional().trim().isNumeric(),
    body("category_id").optional().trim().isNumeric(),
    body("description").optional().trim().isString(),
    body("additional_information").optional().isArray(),
    body("additional_information.*.id").optional().trim().isNumeric(),
    body("additional_information.*.title").optional().trim().isString(),
    body("additional_information.*.description").optional().trim().isString(),
    body("service_options").optional().isArray(),
    body("service_options.*.name").optional().trim().isString(),
    body("service_options.*.discount").optional().trim().isNumeric(),
    body("service_options.*.price").optional().trim().isNumeric(),
    body("service_options.*.description").optional().trim().isString(),
    body("service_options.*.duration").optional().trim().isNumeric(),
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