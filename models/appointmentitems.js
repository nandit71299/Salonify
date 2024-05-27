'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class AppointmentItems extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      AppointmentItems.belongsTo(models.Appointment, { foreignKey: 'appointment_id' });
      AppointmentItems.belongsTo(models.ServiceOptions, { foreignKey: 'service_option_id' });
      AppointmentItems.belongsTo(models.ServiceOptions, { foreignKey: 'service_option_id' }); // Define the service option associated with the appointment item
    }
  }
  AppointmentItems.init({
    appointment_id: DataTypes.INTEGER,
    service_option_id: DataTypes.INTEGER,
    service_price: DataTypes.DECIMAL,
    total_item_discount: DataTypes.DECIMAL,
    total_tax: DataTypes.DECIMAL,
    total_price_paid: DataTypes.DECIMAL
  }, {
    sequelize,
    modelName: 'AppointmentItems',
  });
  return AppointmentItems;
};