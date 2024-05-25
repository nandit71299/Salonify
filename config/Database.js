'use strict';

const Sequelize = require('sequelize');
require('dotenv').config();
const process = require('process');

const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USERNAME, process.env.DB_PASSWORD, {
    host: process.env.DB_HOST,
    dialect: process.env.DB_CONNECTION,
});

module.exports = sequelize;
