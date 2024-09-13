'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Services extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      Services.hasMany(models.ServiceOptions, { foreignKey: 'service_id', });
      Services.hasMany(models.Rating, { foreignKey: 'module_id', scope: { module_type: 2 } });
      Services.belongsTo(models.Branch, { foreignKey: 'branch_id' });
      Services.hasMany(models.AdditionalInformation, { foreignKey: 'service_id' })
    }
  }
  Services.init({
    name: DataTypes.STRING,
    category_id: DataTypes.INTEGER,
    branch_id: DataTypes.INTEGER,
    department_id: DataTypes.INTEGER,
    additional_information_id: DataTypes.INTEGER,
    description: DataTypes.STRING,
    status: DataTypes.INTEGER
  }, {
    sequelize,
    modelName: 'Services',
  });
  return Services;
};