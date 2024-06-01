'use strict';

const { DataTypes } = require('sequelize');
const { getKeyBranchTypes } = require('../../app/enums/branch/Types');

class CreateBranchesTable {
    /**
     * Runs the migration to create the Users table.
     * @param {import('sequelize').QueryInterface} queryInterface
     */
    async up(queryInterface) {
        await queryInterface.createTable('Branches', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: DataTypes.INTEGER
            },
            saloon_id: {
                allowNull: false,
                type: DataTypes.INTEGER,
                references: {
                    model: 'Saloons',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            user_id: {
                allowNull: false,
                type: DataTypes.INTEGER,
                references: {
                    model: 'Users',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            name: {
                type: DataTypes.STRING
            },
            city: {
                type: DataTypes.STRING
            },
            address: {
                type: DataTypes.STRING
            },
            type: {
                type: DataTypes.ENUM(...getKeyBranchTypes()),
                allowNull: false
            },
            contact: {
                type: DataTypes.STRING
            },
            latitude: {
                type: DataTypes.DECIMAL,
                allowNull: true
            },
            longitude: {
                type: DataTypes.DECIMAL,
                allowNull: true
            },
            seats: {
                type: DataTypes.INTEGER
            },
            is_parent: {
                type: DataTypes.BOOLEAN
            },
            image_path: {
                type: DataTypes.STRING
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

module.exports = new CreateBranchesTable();
