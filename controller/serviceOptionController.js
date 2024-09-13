const { Services, ServiceOptions, Sequelize } = require('../models');
const logger = require('../config/logger');
const enums = require('../enums.js')

module.exports = {

    async deleteServiceOption(req, res) {
        try {
            const option_id = req.query.option_id;
            const branch_id = req.query.branch_id;

            // Check if the service option belongs to the supplied branch_id and is active
            const serviceOption = await ServiceOptions.findOne({
                where: {
                    id: option_id,
                    status: enums.is_active.yes
                },
                include: [{
                    model: Services,
                    where: {
                        branch_id: branch_id
                    }
                }]
            });

            if (!serviceOption) {
                return res.status(404).json({
                    success: false,
                    message: "Service Option Not Found",
                    data: []
                });
            }

            // Update the status to mark as inactive
            const updateResult = await ServiceOptions.update(
                { status: enums.is_active.no },
                { where: { id: option_id, status: enums.is_active.yes } }
            );

            if (updateResult[0] > 0) {
                return res.json({ success: true, message: "Service Option Deleted Successfully.", data: [] });
            } else {
                return res.json({ success: false, message: "Service Option Not Found", data: [] });
            }

        } catch (error) {
            logger.error("Error Deleting Service Option", error);
            res.status(500).json({ success: false, message: "Internal server error occurred.", data: [] });
        }
    }

}