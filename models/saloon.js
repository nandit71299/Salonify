'use strict';
const {
    Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
    class Saloon extends Model {
        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            // define association here
            Saloon.hasMany(models.Branch, { foreignKey: 'saloon_id' });

        }
    }
    Saloon.init({
        name: DataTypes.STRING,
        user_id: DataTypes.INTEGER,
        // email: DataTypes.STRING,
        // contact_number: DataTypes.STRING,
        description: DataTypes.STRING,
        status: DataTypes.INTEGER,
        // type: DataTypes.INTEGER,
        // address: DataTypes.INTEGER
    }, {
        sequelize,
        modelName: 'Saloon',
    });
    return Saloon;
};
