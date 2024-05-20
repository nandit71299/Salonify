'use strict';

const { DataTypes } = require('sequelize');

class CreateUsersTable {
    /**
     * Runs the migration to create the Users table.
     * @param {import('sequelize').QueryInterface} queryInterface
     */
    async up(queryInterface) {
        await queryInterface.createTable('Users', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: DataTypes.INTEGER
            },
            name: {
                type: DataTypes.STRING
            },
            phone_number: {
                type: DataTypes.STRING,
                unique: true,
            },
            email: {
                type: DataTypes.STRING,
                unique: true,
            },
            password: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            date_of_birth: {
                type: DataTypes.DATEONLY,
                allowNull: true,
            },
            user_type: {
                type: DataTypes.INTEGER
            },
            status: {
                type: DataTypes.INTEGER,
                defaultValue: 1
            },
            designation: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            hired_date: {
                type: DataTypes.DATE,
                allowNull: true,
            },
            otp: {
                type: DataTypes.INTEGER,
                allowNull: true,
            },
            otp_validity: {
                type: DataTypes.DATE,
                allowNull: true,
            },
            reset_password: {
                type: DataTypes.DATE,
                allowNull: true,
            },
            is_verified: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },
            createdAt: {
                allowNull: false,
                type: DataTypes.DATE
            },
            updatedAt: {
                allowNull: false,
                type: DataTypes.DATE
            }
        });
    }

    /**
     * Reverts the migration by dropping the Users table.
     * @param {import('sequelize').QueryInterface} queryInterface
     */
    async down(queryInterface) {
        await queryInterface.dropTable('Users');
    }
}

module.exports = new CreateUsersTable();
