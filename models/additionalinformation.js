'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class AdditionalInformation extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  AdditionalInformation.init({
    title: DataTypes.STRING,
    description: DataTypes.STRING,
    service_id: DataTypes.INTEGER,
    status: {
      type: DataTypes.INTEGER,
      defaultValue: 1 // Set default value to 1
    }
  }, {
    sequelize,
    modelName: 'AdditionalInformation',
  });
  return AdditionalInformation;
};