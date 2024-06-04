const { validationResult, body, check } = require('express-validator');
const logger = require('../config/logger');
const moment = require('moment')

exports.validateBranchHours = [
    check('branch_id')
        .exists().withMessage('branch_id is required')
        .isInt().withMessage('branch_id must be an integer'),

    check('store_hours')
        .exists().withMessage('store_hours is required')
        .isArray().withMessage('store_hours must be an array'),

    check('store_hours.*.day')
        .isIn(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])
        .withMessage('Invalid day of the week'),

    body('store_hours.*.status').isIn([0, 1]).withMessage("Status must only be 0 or 1"),

    body('store_hours').custom((store_hours) => {
        const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        const providedDays = store_hours.map(hour => hour.day.toLowerCase());
        const missingDays = daysOfWeek.filter(day => !providedDays.includes(day));

        if (missingDays.length > 0) {
            throw new Error(`Timings must be provided for all days of the week. Missing: ${missingDays.join(', ')}`);
        }

        store_hours.forEach(hour => {
            if (!hour.day || !hour.start_time || !hour.end_time || hour.status === undefined) {
                throw new Error(`Each store hour entry must include day, start_time, end_time, and status`);
            }

            // Ensure start_time and end_time are in 24-hour format HH:mm
            const startTime = moment(hour.start_time, "HH:mm", true);
            const endTime = moment(hour.end_time, "HH:mm", true);

            if (!startTime.isValid() || !endTime.isValid()) {
                throw new Error(`start_time and end_time must be in the format HH:mm for ${hour.day}`);
            }

            if (endTime.isSameOrBefore(startTime)) {
                throw new Error(`end_time should be after start_time for ${hour.day}`);
            }

            if (typeof hour.status !== 'number') {
                throw new Error(`status should be a number for ${hour.day}`);
            }
        });

        return true;
    }),
    (request, response, next) => {
        const errors = validationResult(request);
        if (!errors.isEmpty()) {
            logger.error("Bad Request:", errors.array());
            return response.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
        }
        next();
    }
];

exports.validateGetBranchHours = [
    check('branch_id').isNumeric().withMessage('Branch ID should be numeric'),
    (request, response, next) => {
        const errors = validationResult(request);
        if (!errors.isEmpty()) {
            logger.error("Bad Request:", errors.array());
            return response.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
        }

        next();
    }

];

exports.validateInsertBranchHoliday = [
    body('branch_id').isNumeric().withMessage('Branch ID must be an integer'),
    body('from_date').custom((value, { req }) => {
        const from_date = moment(req.body.from_date, "YYYY-MM-DD HH:mm:ss").format("YYYY-MM-DD HH:mm:ss");
        const currentDate = moment().format("YYYY-MM-DD HH:mm:ss");
        if (moment(from_date).isBefore(currentDate)) {
            throw new Error('From date can not be in past.');
        }
        return true;
    }),
    body('to_date').custom((value, { req }) => {
        const to_date = moment(req.body.to_date, "YYYY-MM-DD HH:mm:ss");
        const currentDate = moment().format("YYYY-MM-DD HH:mm:ss");
        if (moment(to_date).isBefore(currentDate)) {
            throw new Error('To date can not be in past.');
        }
        return true;
    }),
    body('from_date')
        .isISO8601().withMessage('from_date must be a valid date')
        .custom((value, { req }) => {
            const toDate = req.body.to_date;
            if (moment(value).isAfter(toDate)) {
                throw new Error('from_date cannot be after to_date');
            }
            return true;
        }),
    body('to_date')
        .isISO8601().withMessage('to_date must be a valid date')
        .custom((value, { req }) => {
            const fromDate = req.body.from_date;
            if (moment(value).isBefore(fromDate)) {
                throw new Error('to_date cannot be before from_date');
            }
            return true;
        }),
    (request, response, next) => {
        const errors = validationResult(request);
        if (!errors.isEmpty()) {
            logger.error("Bad Request:", errors.array());
            return response.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
        }

        next();
    }
];

exports.validateDeleteBranchHoliday = [
    check('id').isNumeric().withMessage("ID must be interger"),
    check('branch_id').isNumeric().withMessage('Branch ID must be an integer'),
    (request, response, next) => {
        const errors = validationResult(request);
        if (!errors.isEmpty()) {
            logger.error("Bad Request:", errors.array());
            return response.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
        }

        next();
    }
];

exports.validateUpdateBranchHoliday = [
    check("id").isNumeric().withMessage("ID should be numeric"),
    check("branch_id").isNumeric().withMessage("Branch ID should be numeric"),
    check("from_date").isISO8601().withMessage("Invalid Date and Time Format"),
    check("to_date").isISO8601().withMessage("Invalid Date and Time Format"),
    check('from_date').custom((value, { req }) => {
        const from_date = moment(req.body.from_date, "YYYY-MM-DD HH:mm:ss").format("YYYY-MM-DD HH:mm:ss");
        const currentDate = moment().format("YYYY-MM-DD HH:mm:ss");
        if (moment(from_date).isBefore(currentDate)) {
            throw new Error('From date can not be in past.');
        }
        return true;
    }),
    body('to_date').custom((value, { req }) => {
        const to_date = moment(req.body.to_date, "YYYY-MM-DD HH:mm:ss");
        const currentDate = moment().format("YYYY-MM-DD HH:mm:ss");
        if (moment(to_date).isBefore(currentDate)) {
            throw new Error('To date can not be in past.');
        }
        return true;
    }),
    (request, response, next) => {
        const errors = validationResult(request);
        if (!errors.isEmpty()) {
            logger.error("Bad Request:", errors.array());
            return response.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
        }

        next();
    }
]

exports.validateGetBranchHoliday = [
    check("branch_id").isNumeric().withMessage("Branch ID should be numeric"),
    (request, response, next) => {
        const errors = validationResult(request);
        if (!errors.isEmpty()) {
            logger.error("Bad Request:", errors.array());
            return response.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
        }

        next();
    }
]


exports.validateGetSalonProfileDetails = [

    check("branch_id").notEmpty().isNumeric(),
    (request, response, next) => {
        const errors = validationResult(request);
        if (!errors.isEmpty()) {
            logger.error("Bad Request:", errors.array());
            return response.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
        }

        next();
    }

]

exports.validateGetDashboard = [

    check('user_id').isNumeric(),
    check('branch_id').isNumeric(),
    (request, response, next) => {
        const errors = validationResult(request);
        if (!errors.isEmpty()) {
            logger.error("Bad Request:", errors.array());
            return response.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
        }

        next();
    }

]

exports.validateGetNearbySalons = [
    check('latitude')
        .isFloat({ min: -90, max: 90 })
        .withMessage('Latitude must be a number between -90 and 90'),
    check('longitude')
        .isFloat({ min: -180, max: 180 })
        .withMessage('Longitude must be a number between -180 and 180'),
    check('city')
        .isString()
        .notEmpty()
        .withMessage('City must be a non-empty string'),
    check('maxDistance')
        .isInt({ min: 0 })
        .withMessage('Max distance must be a non-negative integer'),
    (request, response, next) => {
        const errors = validationResult(request);
        if (!errors.isEmpty()) {
            logger.error("Bad Request:", errors.array());
            return response.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
        }

        next();
    }
]

exports.validateGetBranchesByCategory = [
    check("category_id").isInt().withMessage("Category ID must be an integer"),
    check("city").isString().notEmpty().withMessage("City must be a non-empty string"),
    (request, response, next) => {
        const errors = validationResult(request);
        if (!errors.isEmpty()) {
            logger.error("Bad Request:", errors.array());
            return response.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
        }

        next();
    }
]