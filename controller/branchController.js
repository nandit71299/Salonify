const { User, Saloon, Branch, BranchHour, sequelize } = require('../models');

module.exports = {
    async createBranchHours(req, res) {
        try {

            const branch_id = req.body.branch_id;
            const branch_hours = req.body.store_hours;

            // Check if there is any branch exists with the given branch_id
            const checkBranchExistence = await Branch.findByPk(branch_id);
            if (!checkBranchExistence) {
                return res.status(404).json({ success: false, message: `No Salon/Branch found with the given ID`, data: [] });
            }

            // Check if store hours already exist for this branch
            const checkStoreHourExistence = await BranchHour.findAll({ where: { branch_id: branch_id, status: 1 } });
            if (checkStoreHourExistence.length > 0) {
                return res.status(409).json({ success: false, message: `Store hours already exist for branch with ID ${branch_id}. Please update instead.`, data: [] });
            }

            // Use a transaction to ensure atomicity
            await sequelize.transaction(async (transaction) => {
                // Iterate over each item in the request array
                for (const item of branch_hours) {
                    // Iterate over days and add data to storeHoursData array
                    const { day, start_time, end_time, status } = item;

                    // Insert store hours into the database
                    await BranchHour.create(
                        { branch_id: branch_id, day: day, start_time: start_time, end_time: end_time, status: status },
                        { transaction }
                    );
                }
            });

            res.status(200).json({ success: true, message: "Store hours inserted successfully", data: [] });
        } catch (error) {
            console.error("Error inserting store hours:", error);
            res.status(500).json({ success: false, message: "Internal server error occurred.", data: [] });
        }
    }
}