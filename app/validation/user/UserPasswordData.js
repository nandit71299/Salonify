'use strict';

const { validationResult, check } = require('express-validator');
const path = require('path');
const logger = require(path.join(path.dirname(require.main.filename), 'config', 'Logger.js'));

class UserPasswordData {
	static validateUserPassword() {
		return [
			check('user_id').trim().isInt(),
            check('password').trim().not().isEmpty().isString(),
            check('confirm_password').trim()
                .not()
                .isEmpty()
                .custom((value, { req }) => {
                    return value === req.body.password;
                })
                .withMessage('Passwords must match'),
			(request, response, next) => {
				const errors = validationResult(request);
				if (!errors.isEmpty()) {
					logger.error('Bad Request:', errors.array());
					return response.status(400).json({
						success: false,
						message: '400 Bad Request',
						errors: errors.array(),
					});
				}
				next();
			}
		];
	}
}

module.exports = UserPasswordData;
