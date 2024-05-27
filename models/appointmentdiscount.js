'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class AppointmentDiscount extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      AppointmentDiscount.belongsTo(models.Appointment, { foreignKey: 'appointment_id' });
    }
  }
  AppointmentDiscount.init({
    appointment_id: DataTypes.INTEGER,
    coupon_type: DataTypes.STRING,
    coupon_id: DataTypes.INTEGER,
    amount: DataTypes.DECIMAL
  }, {
    sequelize,
    modelName: 'AppointmentDiscount',
  });
  return AppointmentDiscount;
};