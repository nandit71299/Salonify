'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class CartItems extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      CartItems.belongsTo(models.Cart, {
        foreignKey: 'cart_id',
      });
      CartItems.belongsTo(models.ServiceOptions, {
        foreignKey: 'service_option_id',
      });
    }
  }
  CartItems.init({
    cart_id: DataTypes.INTEGER,
    service_option_id: DataTypes.INTEGER
  }, {
    sequelize,
    modelName: 'CartItems',
  });
  return CartItems;
};