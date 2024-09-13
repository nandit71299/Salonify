'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        const { DataTypes } = Sequelize;

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
            createdAt: {
                allowNull: false,
                type: DataTypes.DATE
            },
            updatedAt: {
                allowNull: false,
                type: DataTypes.DATE
            }
        });
    },
    async down(queryInterface, Sequelize) {
        await queryInterface.dropTable('User');
    }
};
