const logger = require('../config/logger');
const { User, Saloon, Branch, BranchHour, sequelize, HolidayHour, PlatformCoupon, PlatformCouponBranch } = require('../models');
const { Op, fn, col } = require('sequelize');
const enums = require('../enums')
const fs = require('fs');
const moment = require('moment');
moment.tz("Asia/Kolkata");


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
                        {
                            branch_id: branch_id,
                            day: day.toLowerCase(),
                            start_time: moment(start_time, "HH:mm").format("HH:mm"),
                            end_time: moment(end_time, "HH:mm").format("HH:mm"),
                            status: status
                        },
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
                const start_time = moment(data.start_time, "HH:mm").format("HH:mm");
                const end_time = moment(data.end_time, "HH:mm").format("HH:mm");
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
                            start_time: moment(start_time, "HH:mm").format("HH:mm"),
                            end_time: moment(end_time, "HH:mm").format("HH:mm"),
                            status: status
                        },
                        {
                            where: { day: day.toLowerCase(), branch_id: branch_id }
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
                            { from_date: { [Op.lte]: moment(to_date, "YYYY-MM-DD HH:mm").format("YYYY-MM-DD HH:mm:ss") } },
                            { to_date: { [Op.gte]: moment(from_date, "YYYY-MM-DD HH:mm").format("YYYY-MM-DD HH:mm:ss") } }
                        ]
                    }
                });
                if (checkExisting[0].dataValues.overlap_count > 0) {
                    return res.status(409).json({ success: false, message: "We're unable to save the new holiday hours because they overlap with existing holiday hours. Please select a different time period or modify existing one.", data: [] });
                } else {
                    // Insert holiday hours
                    const insertHoliday = await HolidayHour.create({
                        branch_id: branch_id,
                        from_date: moment(from_date, "YYYY-MM-DD HH:mm").format("YYYY-MM-DD HH:mm:ss"),
                        to_date: moment(to_date, "YYYY-MM-DD HH:mm").format("YYYY-MM-DD HH:mm:ss"),
                        status: enums.is_active.yes
                    }, { returning: true }, { transaction });
                    res.status(201).json({
                        success: true,
                        message: 'Holiday hours added successfully',
                        data: { id: insertHoliday.dataValues.id }
                    });
                }
            } catch (error) {
                logger.error("Error Creating Holiday: ", error);
                res.status(500).json({ success: false, message: 'Internal server error', data: [] });
            }
        }

        )
    },

    async deleteHoliday(req, res) {
        const { branch_id, id } = req.query;
        await sequelize.transaction(async (transaction) => {
            try {

                const checkBranchExistence = await Branch.findByPk(branch_id);
                if (!checkBranchExistence) {
                    return res.status(404).json({ success: false, message: `No Salon/Branch found with the given ID`, data: [] });
                }

                const validateHoliday = await HolidayHour.findOne({ where: { branch_id: branch_id, status: 1 } });
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
        const checkHolidayExistence = await HolidayHour.findOne({ where: { id: id } });
        if (!checkHolidayExistence) {
            return res.status(404).json({ success: false, message: `Holiday Not Found`, data: [] });
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
        const { branch_id } = req.query;
        const checkBranchExistence = await Branch.findOne({ where: { id: branch_id, status: enums.is_active.yes } });
        if (!checkBranchExistence) {
            return res.status(404).json({ success: false, message: `No Salon/Branch found with the given ID`, data: [] });
        }

        try {

            const getHolidays = await HolidayHour.findAll({ where: { branch_id: branch_id, status: enums.is_active.yes } });
            if (getHolidays.length === 0) {
                return res.status(200).json({
                    success: true,
                    message: "No Holidays Found",
                    data: []
                })
            }

            const data = [];
            if (getHolidays) {
                for (const holiday of getHolidays) {
                    // from_date:moment(holiday.dataValues.from_date, "YYYY-MM-DD HH:mm:ss").format("YYYY-MM-DD HH:mm:ss"))
                    const id = holiday.dataValues.id;
                    const branch_id = holiday.dataValues.branch_id;
                    const from_date = moment(holiday.dataValues.from_date).format("YYYY-MM-DD HH:mm:ss");
                    const to_date = moment(holiday.dataValues.to_date).format("YYYY-MM-DD HH:mm:ss");
                    const status = holiday.dataValues.status;

                    data.push({ id, branch_id, from_date, to_date, status });
                }
            }
            return res.status(200).json({
                success: true,
                message: "OK",
                data: data
            })

        } catch (error) {
            logger.error("Error getting holidays: ", error);
            res.status(500).json({ success: false, message: 'Internal server error', data: [] });
        }
    },

    async getSalonProfileDetails(req, res) {
        try {
            const branch_id = req.query.branch_id;

            // Fetch branch details using Sequelize
            const branchDetails = await Branch.findOne({
                where: {
                    id: branch_id,
                    status: enums.is_active.yes
                }
            });

            if (!branchDetails) {
                return res.status(404).json({
                    success: false,
                    message: "Salon/Branch not found.",
                    data: []
                })
            }

            const imagePath = branchDetails.image;
            const image = fs.readFileSync(imagePath);
            const base64Image = new Buffer.from(image).toString('base64');
            const response = {
                id: branchDetails.id,
                saloon_id: branchDetails.saloon_id,
                name: branchDetails.name,
                city: branchDetails.city,
                address: branchDetails.address,
                type: branchDetails.type === 1 ? "Unisex" : branchDetails.type === 2 ? "Men's" : branchDetails.type === 3 ? "Women's" : "Unknown",
                contact: branchDetails.contact,
                image: base64Image,
                latitude: branchDetails.latitude,
                longitude: branchDetails.longitude,
                seats: branchDetails.seats,
                status: branchDetails.status,
            }

            res.status(200).json({
                success: true,
                data: response,
                message: "OK"
            });

        } catch (error) {
            logger.error("Error Fetching Salon/Branch Details", error);
            res.status(500).json({
                success: false,
                message: "Internal Server Error"
            });
        }
    },

    async getDashboard(req, res) {

        const userId = req.query.user_id;
        const branchId = req.query.branch_id;

        try {
            // Get User Information
            const user = await User.findOne({
                where: {
                    id: userId,
                    status: enums.is_active.yes,
                    user_type: enums.UserType.salon_admin
                }
            });

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: "User not found.",
                    data: []
                });
            }

            // Get Salon Information
            const salon = await Saloon.findOne({
                include: {
                    model: Branch,
                    where: {
                        id: branchId,
                        status: enums.is_active.yes
                    }
                },
                where: {
                    user_id: userId
                }
            });

            if (!salon) {
                return res.status(404).json({
                    success: false,
                    message: "Salon/Branch not found",
                    data: []
                });
            }

            // Get Branches
            const branches = await Branch.findAll({
                where: {
                    saloon_id: salon.id,
                    status: enums.is_active.yes
                }
            });

            // Check if there are any offers available to participate
            const offersCount = await PlatformCoupon.count({
                where: {
                    id: {
                        [Op.notIn]: sequelize.literal(`(SELECT platform_coupon_id FROM platform_coupon_branch WHERE branch_id = ${branchId})`)
                    },
                    status: enums.is_active.yes
                }
            });

            const offerbannertoshow = offersCount > 0;

            const data = {
                user: {
                    name: user.name,
                    salon_name: salon.name
                },
                branches,
                offerbannertoshow
            };

            res.json({ success: true, data, message: "OK" });
        } catch (error) {
            logger.error("Error in dashboard route:", error);
            res.status(500).json({
                success: false,
                data: [],
                message: "Internal server error."
            });
        }

    }

}