'use strict';

const { Model, DataTypes } = require('sequelize');
const path = require('path');
const sequelize = require(path.join(path.dirname(require.main.filename), 'config', 'Database.js'));

class Saloon extends Model {
    static associate(models) {
        this.hasMany(models.Branch, { foreignKey: 'saloon_id', as: 'branches' });
    }
}

Saloon.init({
    name: DataTypes.STRING,
    email: DataTypes.STRING,
    contact_number: DataTypes.STRING,
    description: DataTypes.STRING,
    status: DataTypes.INTEGER,
    type: DataTypes.INTEGER,
    address: DataTypes.INTEGER
}, {
    sequelize,
    modelName: 'Saloon',
});

module.exports = { Saloon, sequelize };
