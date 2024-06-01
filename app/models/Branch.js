'use strict';

const { Model, DataTypes } = require('sequelize');
const path = require('path');
const sequelize = require(path.join(path.dirname(require.main.filename), 'config', 'Database.js'));
const { getBranchTypes } = require(path.join(path.dirname(require.main.filename), 'app', 'enums', 'branch', 'Types.js'));

class Branch extends Model {
    static associate(models) {
        this.belongsTo(models.Saloon, { foreignKey: 'saloon_id', as: 'saloon' });
        this.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    }
}

Branch.init({
    saloon_id: DataTypes.INTEGER,
    user_id: DataTypes.INTEGER,
    name: DataTypes.STRING,
    city: DataTypes.STRING,
    address: DataTypes.STRING,
    type: {
        type: DataTypes.ENUM,
        values: getBranchTypes(),
        allowNull: false
    },
    contact: DataTypes.STRING,
    latitude: DataTypes.DECIMAL,
    longitude: DataTypes.DECIMAL,
    seats: DataTypes.INTEGER,
    is_parent: DataTypes.BOOLEAN,
    image_path: DataTypes.STRING
}, {
    sequelize,
    modelName: 'Branch',
});

module.exports = { Branch, sequelize };
