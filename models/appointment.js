'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Appointment extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  Appointment.init({
    user_id: DataTypes.INTEGER,
    receipt_number: DataTypes.STRING,
    branch_id: DataTypes.INTEGER,
    settlement_id: DataTypes.INTEGER,
    cancellation_reason_id: DataTypes.INTEGER,
    appointment_date: DataTypes.DATE,
    subtotal: DataTypes.DECIMAL,
    total_discount: DataTypes.DECIMAL,
    total_tax: DataTypes.DECIMAL,
    net_amount: DataTypes.DECIMAL,
    total_amount_paid: DataTypes.DECIMAL,
    is_rescheduled: DataTypes.INTEGER,
    status: DataTypes.INTEGER,
    start_time: DataTypes.TIME,
    end_time: DataTypes.TIME,
    seat_number: DataTypes.INTEGER,
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE
  }, {
    sequelize,
    modelName: 'Appointment',
  });
  return Appointment;
};