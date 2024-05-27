'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class PlatformCoupon extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      PlatformCoupon.hasMany(models.PlatformCouponBranch, {
        foreignKey: 'platform_coupon_id',
        as: 'branches'
      });
    }
  }
  PlatformCoupon.init({
    name: DataTypes.STRING,
    amount: DataTypes.DECIMAL,
    remark: DataTypes.STRING,
    status: DataTypes.INTEGER,
    max_advance_payment: DataTypes.INTEGER,
    advance_percentage: DataTypes.INTEGER
  }, {
    sequelize,
    modelName: 'PlatformCoupon',
  });
  return PlatformCoupon;
};