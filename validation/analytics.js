const { validationResult, check } = require('express-validator');
const logger = require('../config/logger');


exports.validateGetAppointmentAnalyticsWithDateRange = [
    check("branch_id").isNumeric(),
    check("from_date_range").isDate().optional(),
    check("to_date_range").isDate().optional(),
    (request, response, next) => {
        const errors = validationResult(request);
        if (!errors.isEmpty()) {
            logger.error("Bad Request:", errors.array());
            return response.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
        }
        next();
    }
]

exports.validateGetPaymentsWithDateRange = [
    check("branch_id").isNumeric(),
    check("from_date_range").isDate().optional(),
    check("to_date_range").isDate().optional(),
    (request, response, next) => {
        const errors = validationResult(request);
        if (!errors.isEmpty()) {
            logger.error("Bad Request:", errors.array());
            return response.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
        }
        next();
    }
]

exports.validateGetServiceAnalyticsWithDateRange = [
    check("branch_id").isNumeric(),
    check("from_date_range").isDate().optional(),
    check("to_date_range").isDate().optional(),
    check("limit").isNumeric().optional(),
    (request, response, next) => {
        const errors = validationResult(request);
        if (!errors.isEmpty()) {
            logger.error("Bad Request:", errors.array());
            return response.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
        }
        next();
    }
]

exports.validateGetTopPayingCustomers = [
    check("branch_id").isNumeric(), check("from_date_range").isDate().optional(), check("to_date_range").isDate().optional(),
    (request, response, next) => {
        const errors = validationResult(request);
        if (!errors.isEmpty()) {
            logger.error("Bad Request:", errors.array());
            return response.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
        }
        next();
    }
]

exports.validateGetDetailedAppointmentAnalytics = [
    check("branch_id").isNumeric(), check("from_date_range").isDate().optional(), check("to_date_range").isDate().optional(),
    (request, response, next) => {
        const errors = validationResult(request);
        if (!errors.isEmpty()) {
            logger.error("Bad Request:", errors.array());
            return response.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
        }
        next();
    }
]


exports.validateGetSalesOverTimeReport = [
    check("branch_id").isNumeric(), check("from_date_range").isDate().optional(), check("to_date_range").isDate().optional(),
    (request, response, next) => {
        const errors = validationResult(request);
        if (!errors.isEmpty()) {
            logger.error("Bad Request:", errors.array());
            return response.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
        }
        next();
    }
]


exports.validateGetSalesByServiceReport = [
    check("branch_id").isNumeric(), check("from_date_range").isDate().optional(), check("to_date_range").isDate().optional(),
    (request, response, next) => {
        const errors = validationResult(request);
        if (!errors.isEmpty()) {
            logger.error("Bad Request:", errors.array());
            return response.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
        }
        next();
    }
]

exports.validateGetTopPayingCustomersReport = [
    check("branch_id").isNumeric(), check("from_date_range").isDate().optional(), check("to_date_range").isDate().optional(),
    (request, response, next) => {
        const errors = validationResult(request);
        if (!errors.isEmpty()) {
            logger.error("Bad Request:", errors.array());
            return response.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
        }
        next();
    }

]