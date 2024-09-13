'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('AppointmentItems', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      appointment_id: {
        type: Sequelize.INTEGER
      },
      service_option_id: {
        type: Sequelize.INTEGER
      },
      service_price: {
        type: Sequelize.DECIMAL
      },
      total_item_discount: {
        type: Sequelize.DECIMAL
      },
      total_tax: {
        type: Sequelize.DECIMAL
      },
      total_price_paid: {
        type: Sequelize.DECIMAL
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('AppointmentItems');
  }
};