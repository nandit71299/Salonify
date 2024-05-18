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
        console.log(true)
        next();
    }
];

