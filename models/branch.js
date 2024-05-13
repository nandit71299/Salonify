'use strict';
const {
    Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
    class Branch extends Model {
        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            // define association here
        }
    }
    Branch.init({
        saloon_id: DataTypes.INTEGER,
        user_id: DataTypes.INTEGER,
        name: DataTypes.STRING,
        city: DataTypes.STRING,
        address: DataTypes.STRING,
        type: DataTypes.INTEGER,
        contact: DataTypes.INTEGER,
        latitude: DataTypes.DECIMAL,
        longitude: DataTypes.DECIMAL,
    }, {
        sequelize,
        modelName: 'Branch',
    });
    return Branch;
};
