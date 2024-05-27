'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class ServiceOptions extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      ServiceOptions.belongsTo(models.Services, { foreignKey: 'service_id' });
      ServiceOptions.hasMany(models.AppointmentItems, { foreignKey: 'service_option_id' });

    }
  }
  ServiceOptions.init({
    service_id: DataTypes.INTEGER,
    name: DataTypes.STRING,
    price: DataTypes.DECIMAL,
    discount: DataTypes.DECIMAL,
    description: DataTypes.STRING,
    duration: DataTypes.INTEGER,
    status: DataTypes.INTEGER
  }, {
    sequelize,
    modelName: 'ServiceOptions',
  });
  return ServiceOptions;
};