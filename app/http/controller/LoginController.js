'use strict';

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const process = require('process');
const path = require('path');
const logger = require(path.join(path.dirname(require.main.filename), 'config', 'Logger.js'));

class LoginController {
    constructor(userService) {
        this.userService = userService;
    }

    async login(request, response) {
        try {
            const { username, password } = request.body;

            const user = await this.userService.getUserByEmail(username);

            if (! user) {
                return response
                    .status(412)
                    .json({
                        success: false,
                        error: 'Invalid Credentials'
                    })
                ;
            }

            const passwordMatch = await bcrypt.compare(password, user.password);

            if (! passwordMatch) {
                return response
                    .status(412)
                    .json({
                        success: false,
                        error: 'Invalid Credentials'
                    })
                ;
            }

            const token = jwt.sign(
                { userId: user.id },
                process.env.JWT_SECRET,
                { expiresIn: '1h' }
            );

            return response
                .status(200)
                .json({
                    message: 'Login Successfully',
                    user, token
                })
            ;
        } catch (error) {
            logger.error('Error occurred during registration:', error);
            return response
                .status(500)
                .json({
                    success: false,
                    message: 'Internal Server Error',
                    error: 'error'
                })
            ;
        }
    }
}

module.exports = LoginController;
