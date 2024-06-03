'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class BranchCoupon extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  BranchCoupon.init({
    name: DataTypes.STRING,
    remark: DataTypes.STRING,
    status: DataTypes.INTEGER,
    amount: DataTypes.INTEGER,
    max_advance_amount: DataTypes.INTEGER,
    advance_percentage: DataTypes.INTEGER,
    minimum_subtotal: DataTypes.INTEGER,
    start_date: DataTypes.DATE,
    end_date: DataTypes.DATE,
    branch_id: DataTypes.INTEGER
  }, {
    sequelize,
    modelName: 'BranchCoupon',
  });
  return BranchCoupon;
};