const { validationResult, check, body } = require('express-validator');
const logger = require('../config/logger');
const enums = require('../enums')

exports.validateCreateOrUpdateWishlist = [

    check('user_id').isInt(),
    check('type_id').isInt(),
    check('wishlist_type').isIn([enums.wishlist_type.branch, enums.wishlist_type.service]),
    (request, response, next) => {
        const errors = validationResult(request);
        if (!errors.isEmpty()) {
            logger.error("Bad Request:", errors.array());
            return response.status(400).json({ success: false, message: "400 Bad Request", errors: errors.array(), data: [] });
        }
        next();
    }
]

exports.validateGetAllWishlistedItems = [
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