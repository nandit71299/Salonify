'use strict';

const path = require('path');
const sequelize = require(path.join(path.dirname(require.main.filename), 'config', 'Database.js'));
const logger = require(path.join(path.dirname(require.main.filename), 'config', 'Logger.js'));
const saloonService = require(path.join(path.dirname(require.main.filename), 'app', 'services', 'saloon', 'SaloonService.js'));
const userService = require(path.join(path.dirname(require.main.filename), 'app', 'services', 'user', 'UserService.js'));
const branchService = require(path.join(path.dirname(require.main.filename), 'app', 'services', 'branch', 'BranchService.js'));
const registrationResource = require(path.join(path.dirname(require.main.filename), 'app', 'resource', 'registration', 'RegistrationResource.js'));
const fs = require('fs');

const saloonServiceObject = new saloonService();
const branchServiceObject = new branchService();
const userServiceObject = new userService();

class RegisterController {
    async register(request, response) {
        const token = request.headers.authorization?.split(' ')[1];

        if (! token) {
            return response
                .status(412)
                .json({
                    message: 'Un-Authenticated'
                });
        }

        const userId = await userServiceObject.verifyToken(token);

        if (! userId) {
            return response
                .status(412)
                .json({
                    message: 'Invalid token'
                });
        }

        if (!request.file) {
            return response.status(412).json({
                message: 'No image uploaded'
            });
        }

        const imageFile = request.file;

        const filePath = path.join(path.dirname(require.main.filename), 'public', 'salon_images', imageFile.originalname);
        fs.rename(imageFile.path, filePath, (error) => {
            if (error) {
                logger.error('image failed to upload:', error);
                response.status(412).json({
                    error
                });
            }
        });

        const transaction = await sequelize.transaction();

        try {
            const saloonData = { name: request.body.saloon_name, description: request.body.saloon_description };
            const saloon = await saloonServiceObject.addNew(saloonData);

            const branchData = {
                user_id: userId,
                saloon_id: saloon.id,
                name: request.body.branch_name,
                city: request.body.branch_city,
                address: request.body.branch_address,
                type: request.body.branch_type,
                contact: request.body.branch_contact,
                latitude: request.body.branch_latitude,
                longitude: request.body.branch_longitude,
                seats: request.body.branch_seats,
                image_path: filePath,
                is_parent: true,
            };

            const branch = await branchServiceObject.addNew(branchData);

            await transaction.commit();

            return response.status(201).json({
                success: true,
                message: 'Saloon And Branch registered successfully.',
                data: new registrationResource(saloon, branch).toArray(),
            });
        } catch (error) {
            await transaction.rollback();
            logger.error('Error occurred during registration:', error);
            response.status(500).json({
                error
            });
        }
    }
}

module.exports = RegisterController;
