'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Add altering commands here.
     *
     * Example:
     * await queryInterface.createTable('users', { id: Sequelize.INTEGER });
     */

    const { DataTypes } = Sequelize;

    await queryInterface.createTable('Branch', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER
      },
      saloon_id: {
        type: DataTypes.INTEGER,
        unique: true,
      },
      name: {
        type: DataTypes.STRING,
      },
      city: {
        type: DataTypes.STRING,
      },
      address: {
        type: DataTypes.STRING,
      },
      contact: {
        type: DataTypes.INTEGER,
      },
      latitude: {
        type: DataTypes.DECIMAL,
      },
      longitude: {
        type: DataTypes.DECIMAL,
      }

    },
      // await queryInterface.addConstraint("role_permissions", {
      //   type: "foreign key",
      //   fields: ["saloon_id"],
      //   name: "fk_role_permissions__role",
      //   references: {
      //     table: "Saloons",
      //     field: "id",
      //   },
      // }));
    )
  },


  async down(queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
  }
};
