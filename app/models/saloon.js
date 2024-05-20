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
		static associate() {
			// define association here
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
	return Saloon;
};
