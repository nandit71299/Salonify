'use strict';

const { Model, DataTypes } = require('sequelize');
const path = require('path');
const sequelize = require(path.join(path.dirname(require.main.filename), 'config', 'Database.js'));

class User extends Model {}

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
  reset_password: DataTypes.DATE,
  is_verified: DataTypes.BOOLEAN
}, {
  sequelize,
});

module.exports = { User, sequelize };
