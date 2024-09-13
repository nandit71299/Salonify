'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class BranchHour extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  BranchHour.init({
    branch_id: DataTypes.INTEGER,
    day: DataTypes.STRING,
    start_time: DataTypes.TIME,
    end_time: DataTypes.TIME,
    status: DataTypes.INTEGER
  }, {
    sequelize,
    modelName: 'BranchHour',
  });
  return BranchHour;
};