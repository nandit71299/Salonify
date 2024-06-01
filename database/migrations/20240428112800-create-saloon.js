'use strict';

const { DataTypes } = require('sequelize');

class CreateSaloonsTable {
    /**
     * Runs the migration to create the Users table.
     * @param {import('sequelize').QueryInterface} queryInterface
     */
    async up(queryInterface) {
        await queryInterface.createTable('Saloons', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: DataTypes.INTEGER
            },
            name: {
                type: DataTypes.STRING,
                unique: true
            },
            description: {
                type: DataTypes.STRING
            },
            status: {
                type: DataTypes.INTEGER,
                default: 1
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
}

module.exports = new CreateSaloonsTable();
