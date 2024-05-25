'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('Branches', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER
            },
            saloon_id: {
                type: Sequelize.INTEGER
            },
            user_id: {
                type: Sequelize.INTEGER
            },
            name: {
                type: Sequelize.STRING
            },
            city: {
                type: Sequelize.STRING
            },
            address: {
                type: Sequelize.STRING
            },
            type: {
                type: Sequelize.INTEGER
            },
            contact: {
                type: Sequelize.STRING
            },
            latitude: {
                type: Sequelize.DECIMAL
            },
            longitude: {
                type: Sequelize.DECIMAL
            },
            seats: {
                type: Sequelize.INTEGER
            },
            is_parent: {
                type: Sequelize.BOOLEAN
            },
            createdAt: {
                allowNull: false,
                type: Sequelize.DATE
            },
            updatedAt: {
                allowNull: false,
                type: Sequelize.DATE
            }
        });
    },
};
