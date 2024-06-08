const { validationResult, body, check, query } = require('express-validator');
const logger = require('../config/logger');
const moment = require('moment')

exports.validateBranchVacancy = [
    body('branch_id').isNumeric(),
    body("appointment_date").isISO8601(),
    body('services').isArray(),
    body('services.*.service_id').isNumeric(),
    (request, response, next) => {
        const errors = validationResult(request);
        if (!errors.isEmpty()) {
            logger.error("Bad Request:", errors.array());
            return response.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
        }
        next();
    }
]

exports.validateApointmentBooking = [
    check("user_id").isNumeric(),
    check("branch_id").isNumeric(),
    check("appointment_date").isDate(),
    check("start_time").custom(value => {
        return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value) ? true : (() => {
            throw new Error('Value must be in the time format HH:MM');
        })();
    }),
    check("services").isArray(),
    check("services.*").isNumeric(),
    check("platform_coupon_id").optional().isNumeric().withMessage("Platform Coupon ID Must Be Type Of INTEGER"),
    (request, response, next) => {
        const errors = validationResult(request);
        if (!errors.isEmpty()) {
            logger.error("Bad Request:", errors.array());
            return response.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
        }
        next();
    }
]

exports.validateGetAllAppointments = [
    check("branch_id").isNumeric(),

    (request, response, next) => {
        const errors = validationResult(request);
        if (!errors.isEmpty()) {
            logger.error("Bad Request:", errors.array());
            return response.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
        }
        next();
    }

]

exports.validateGetAppoitmentDetails = [
    check("appointment_id").isNumeric(), check("branch_id").isNumeric(),
    (request, response, next) => {
        const errors = validationResult(request);
        if (!errors.isEmpty()) {
            logger.error("Bad Request:", errors.array());
            return response.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
        }
        next();
    }
]

exports.validateGetBookingHistory = [

    check("user_id").isInt(),
    (request, response, next) => {
        const errors = validationResult(request);
        if (!errors.isEmpty()) {
            logger.error("Bad Request:", errors.array());
            return response.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
        }
        next();
    }
]

exports.validateGetCustomerAppointmentDetails = [

    check("appointment_id").isInt(), check("branch_id").isInt(),
    check('user_id').isNumeric(),
    (request, response, next) => {
        const errors = validationResult(request);
        if (!errors.isEmpty()) {
            logger.error("Bad Request:", errors.array());
            return response.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
        }
        next();
    }
]

exports.validateGetCancellationSummary = [

    query('appointment_id').isNumeric(),
    query('branch_id').isNumeric(),
    query('user_id').isNumeric(),
    (request, response, next) => {
        const errors = validationResult(request);
        if (!errors.isEmpty()) {
            logger.error("Bad Request:", errors.array());
            return response.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
        }
        next();
    }
]

exports.validateRescheduleAppointment = [
    check("appointment_id").isInt(),
    check("newDate").isISO8601(),
    check("newStartTime").isString(),
    (request, response, next) => {
        const errors = validationResult(request);
        if (!errors.isEmpty()) {
            logger.error("Bad Request:", errors.array());
            return response.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
        }
        next();
    }
]

exports.validateReserveASeat = [
    query('user_id').isNumeric(),
    query('platform_coupon_id').isNumeric().optional(),
    query('branch_coupon_id').isNumeric().optional(),
    query('branch_id').isNumeric(),
    query('appointment_date').isISO8601(),
    query('appointment_time').isTime(),
    (request, response, next) => {
        const errors = validationResult(request);
        if (!errors.isEmpty()) {
            logger.error("Bad Request:", errors.array());
            return response.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
        }
        next();
    }

]