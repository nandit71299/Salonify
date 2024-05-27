'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class PlatformCouponBranch extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      PlatformCouponBranch.belongsTo(models.PlatformCoupon, {
        foreignKey: 'platform_coupon_id',
        as: 'coupon'
      });
    }
  }
  PlatformCouponBranch.init({
    branch_id: DataTypes.INTEGER,
    platform_coupon_id: DataTypes.INTEGER,
    status: DataTypes.INTEGER,
  }, {
    sequelize,
    modelName: 'PlatformCouponBranch',
  });
  return PlatformCouponBranch;
};