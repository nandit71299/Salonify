const logger = require('../config/logger');
const { User, Saloon, Branch, BranchHour, sequelize, HolidayHour } = require('../models');
const { Op, fn, col, where } = require('sequelize');

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
    },

    async getBranchHours(req, res) {
        const branch_id = req.body.branch_id;
        try {
            const getStoreHours = await BranchHour.findAll({ where: { branch_id: branch_id, status: 1 } });
            const branch_hours = [];
            if (getStoreHours.length < 1) {
                return res.status(404).json({
                    success: true,
                    message: "No Store Hours Data Found",
                    data: [],
                })
            }

            for (const storeHours of getStoreHours) {
                const data = storeHours.dataValues;

                const id = data.id;
                const day = data.day;
                const start_time = data.start_time;
                const end_time = data.end_time;
                const status = data.status;

                branch_hours.push({
                    id: id, day: day, start_time: start_time, end_time: end_time, status: status
                })
            }

            res.status(200).json({ success: true, data: branch_hours.sort((a, b) => a.id - b.id), message: "OK" })
        } catch (error) {
            res.status(500).json({ success: false, message: "Internal server error occurred.", data: [] });
        }
    },

    async updateBranchHours(req, res) {
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
            if (!checkStoreHourExistence.length > 0) {
                return res.status(409).json({ success: false, message: `No Store Hours Found For Salon/Branch ID ${branch_id}. Please INSERT instead.`, data: [] });
            }

            // Use a transaction to ensure atomicity
            await sequelize.transaction(async (transaction) => {
                // Iterate over each item in the request array
                for (const item of branch_hours) {
                    // Iterate over days and add data to storeHoursData array
                    const { day, start_time, end_time, status } = item;

                    // Insert store hours into the database
                    await BranchHour.update(
                        {
                            start_time: start_time, end_time: end_time, status: status
                        },
                        {
                            where: { day: day, branch_id: branch_id }
                        },
                        { transaction }
                    );
                }
            });

            res.status(200).json({ success: true, message: "Store hours updated successfully", data: [] });
        } catch (error) {
            console.error("Error inserting store hours:", error);
            res.status(500).json({ success: false, message: "Internal server error occurred.", data: [] });
        }
    },

    async createHoliday(req, res) {
        const { branch_id, from_date, to_date } = req.body;
        await sequelize.transaction(async (transaction) => {
            try {

                const checkBranchExistence = await Branch.findByPk(branch_id);
                if (!checkBranchExistence) {
                    return res.status(404).json({ success: false, message: `No Salon/Branch found with the given ID`, data: [] });
                }

                const checkExisting = await HolidayHour.findAll({
                    attributes: [[fn('COUNT', col('*')), 'overlap_count']],
                    where: {
                        branch_id: branch_id,
                        status: 1,
                        [Op.and]: [
                            { from_date: { [Op.lte]: to_date } },
                            { to_date: { [Op.gte]: from_date } }
                        ]
                    }
                });
                if (checkExisting[0].dataValues.overlap_count > 0) {
                    res.status(409).json({ success: false, message: "We're unable to save the new holiday hours because they overlap with existing holiday hours. Please select a different time period or modify existing one.", data: [] });
                } else {
                    // Insert holiday hours
                    const insertHoliday = await HolidayHour.create({ branch_id: branch_id, from_date: from_date, to_date: to_date, status: 1 }, { returning: true }, { transaction });
                    res.status(201).json({ success: true, message: 'Holiday hours added successfully', data: { id: insertHoliday.dataValues.id } });
                }
            } catch (error) {
                logger.error("Error Creating Holiday: ", error);
                res.status(500).json({ success: false, message: 'Internal server error', data: [] });
            }
        }

        )
    },

    async deleteHoliday(req, res) {
        const { branch_id, id } = req.body;
        await sequelize.transaction(async (transaction) => {
            try {

                const checkBranchExistence = await Branch.findByPk(branch_id);
                if (!checkBranchExistence) {
                    return res.status(404).json({ success: false, message: `No Salon/Branch found with the given ID`, data: [] });
                }

                const validateHoliday = await HolidayHour.find({ where: { branch_id: branch_id, status: 1 } });
                if (!validateHoliday) {
                    return res.status(404).json({
                        success: false,
                        message: "Holiday not found or it is already deleted.",
                        data: [],
                    })
                }

                const [affectedRows, [updateHoliday]] = await HolidayHour.update(
                    { status: 0 },
                    {
                        where: { id: id },
                        returning: true
                    },
                    { transaction },

                )

                if (affectedRows > 0) {
                    res.status(200).json({
                        success: true,
                        message: "Holiday Deleted Succesfully",
                        data: [],
                    })
                } else if (!affectedRows > 0) {
                    res.status(404).json({
                        success: false,
                        message: "Holiday either already deleted or did not exists.",
                        data: []
                    })
                }

            } catch (error) {
                logger.error("Error Deleting Holiday: ", error);
                res.status(500).json({ success: false, message: 'Internal server error', data: [] });
            }
        }

        )
    },

    async updateHoliday(req, res) {
        const { id, branch_id, from_date, to_date } = req.body;
        const checkBranchExistence = await Branch.findByPk(branch_id);

        if (!checkBranchExistence) {
            return res.status(404).json({ success: false, message: `No Salon/Branch found with the given ID`, data: [] });
        }
        await sequelize.transaction(async (transaction) => {
            try {
                await HolidayHour.update({ from_date: from_date, to_date: to_date }, { where: { branch_id: branch_id, id: id }, returning: true }, { transaction })
                res.status(201).json({
                    success: true,
                    message: "Holiday updated succesfully",
                    data: [],
                })
            } catch (error) {
                logger.error("Error Deleting Holiday: ", error);
                res.status(500).json({ success: false, message: 'Internal server error', data: [] });
            }

        })
    },

    async getHoliday(req, res) {
        const { branch_id } = req.body;
        const checkBranchExistence = await Branch.findOne({ where: { id: branch_id, status: 1 } });

        try {
            if (!checkBranchExistence) {
                return res.status(404).json({ success: false, message: `No Salon/Branch found with the given ID`, data: [] });
            }

            const getHolidays = await HolidayHour.findAll({ where: { branch_id: branch_id, status: 1 } });
            if (getHolidays.length === 0) {
                return res.status(200).json({
                    success: true,
                    message: "No Holidays Found",
                    data: []
                })
            }

            if (getHolidays) {
                const data = [];
                for (const holiday of getHolidays) {
                    data.push(holiday.dataValues);
                }
                return res.status(200).json({
                    success: true,
                    message: "OK",
                    data: data
                })
            }

        } catch (error) {
            logger.log("Error getting holidays: ", error);
            res.status(500).json({ success: false, message: 'Internal server error', data: [] });
        }
    },



}