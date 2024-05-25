'use strict';

const jwt = require('jsonwebtoken');
const User = require('../../models/user');
const process = require('process');
const path = require('path');
const logger = require(path.join(path.dirname(require.main.filename), 'config', 'Logger.js'));

class AuthMiddleware {
    static async authenticate(req, res, next) {
        try {
            const token = req.headers.authorization.split(' ')[1];
            if (!token) {
                return res.status(401).json({ error: 'Authorization header missing' });
            }

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const userId = decoded.userId;

            const user = await User.findByPk(userId);
            if (!user) {
                return res.status(401).json({ error: 'User not found' });
            }

            req.user = user;

            next();
        } catch (error) {
            logger(error);
            res.status(401).json({ error: 'Invalid or expired token' });
        }
    }
}

module.exports = AuthMiddleware;
