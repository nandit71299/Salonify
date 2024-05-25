'use strict';

const { validationResult, check } = require('express-validator');
const path = require('path');
const logger = require(path.join(path.dirname(require.main.filename), 'config', 'Logger.js'));

class UserUpdateData {
    static validateUserUpdate() {
        return [
            check('name').trim().isString(),
            check('email').trim().isEmail(),
            check('phone_number').trim().isMobilePhone(),
            check('date_of_birth').trim().isDate(),
            check('designation').trim().isString(),
            (request, response, next) => {
                const errors = validationResult(request);
                if (!errors.isEmpty()) {
                    logger.error('Bad Request:', errors.array());
                    return response.status(400).json({
                        success: false,
                        message: '400 Bad Request',
                        errors: errors.array(),
                        data: []
                    });
                }
                next();
            }
        ];
    }
}

module.exports = UserUpdateData;
