'use strict';
const {
    Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
    class User extends Model {
        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            // define association here
            User.hasMany(models.Appointment, { foreignKey: 'user_id' });
        }
    }
    User.init({
        name: DataTypes.STRING,
        phone_number: DataTypes.STRING,
        email: DataTypes.STRING,
        password: DataTypes.STRING,
        date_of_birth: DataTypes.DATE,
        user_type: DataTypes.INTEGER,
        status: DataTypes.INTEGER,
        otp: DataTypes.INTEGER,
        otp_validity: DataTypes.INTEGER,
        reset_password: DataTypes.DATE
    }, {
        sequelize,
        modelName: 'User',
    });
    return User;
};
