'use strict';

const { validationResult, check } = require('express-validator');
const path = require('path');
const logger = require(path.join(path.dirname(require.main.filename), 'config', 'Logger.js'));
const multer = require('multer');

const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png'];

class RegistrationData {
    static validateRegistration() {
        const upload = multer({ dest: 'uploads/' });

        return [
            check('saloon_name').trim().isString(),
            check('saloon_description').trim().isString(),
            check('branch_name').trim().isString(),
            check('branch_city').trim().isString(),
            check('branch_address').trim().isString(),
            check('branch_type').trim().isString(),
            check('branch_contact').trim().isString(),
            check('branch_latitude').trim().isString(),
            check('branch_longitude').trim().isString(),
            check('branch_seats').trim().isString(),
            upload.single('branch_image'),
            (request, response, next) => {
                const errors = validationResult(request);
                if (! errors.isEmpty()) {
                    logger.error('Bad Request:', errors.array());
                    return response.status(412).json({
                        success: false,
                        message: '400 Bad Request',
                        errors: errors.array(),
                    });
                }

                if (!request.file) {
                    errors.push({ message: 'No image uploaded' });
                    return response.status(412).json({
                        success: false,
                        message: '400 Bad Request',
                        errors: errors.array(),
                    });
                }

                if (!allowedMimeTypes.includes(request.file.mimetype)) {
                    errors.push({ message: 'Invalid image format. Only JPEG and PNG allowed.' });
                    return response.status(412).json({
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

module.exports = RegistrationData;
