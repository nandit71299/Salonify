'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Payments extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  Payments.init({
    user_id: DataTypes.INTEGER,
    appointment_id: DataTypes.INTEGER,
    payment_gateway_transaction_id: DataTypes.INTEGER,
    payment_method: DataTypes.STRING,
    payment_date: DataTypes.DATE,
    amount: DataTypes.DECIMAL,
    status: DataTypes.INTEGER,
    remarks: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'Payments',
  });
  return Payments;
};