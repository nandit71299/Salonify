'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Appointments', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      id: {
        type: Sequelize.INTEGER
      },
      user_id: {
        type: Sequelize.INTEGER
      },
      receipt_number: {
        type: Sequelize.STRING
      },
      branch_id: {
        type: Sequelize.INTEGER
      },
      settlement_id: {
        type: Sequelize.INTEGER
      },
      cancellation_reason_id: {
        type: Sequelize.INTEGER
      },
      appointment_date: {
        type: Sequelize.DATE
      },
      subtotal: {
        type: Sequelize.DECIMAL
      },
      total_discount: {
        type: Sequelize.DECIMAL
      },
      total_tax: {
        type: Sequelize.DECIMAL
      },
      net_amount: {
        type: Sequelize.DECIMAL
      },
      total_amount_paid: {
        type: Sequelize.DECIMAL
      },
      is_rescheduled: {
        type: Sequelize.INTEGER
      },
      status: {
        type: Sequelize.INTEGER
      },
      start_time: {
        type: Sequelize.TIME
      },
      end_time: {
        type: Sequelize.TIME
      },
      seat_number: {
        type: Sequelize.INTEGER
      },
      created_at: {
        type: Sequelize.DATE
      },
      updated_at: {
        type: Sequelize.DATE
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
    await queryInterface.dropTable('Appointments');
  }
};