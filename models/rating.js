'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Rating extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Rating.belongsTo(models.Branch, {
        foreignKey: 'module_id',
        scope: {
          module_type: 1 // Assuming 1 represents branches
        }
      });

      Rating.belongsTo(models.Services, {
        foreignKey: 'module_id',
        scope: {
          module_type: 2 // Assuming 2 represents services
        }
      });
    }
  }
  Rating.init({
    user_id: DataTypes.INTEGER,
    module_type: DataTypes.INTEGER,
    module_id: DataTypes.INTEGER,
    rating: DataTypes.INTEGER,
    comment: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'Rating',
  });
  return Rating;
};