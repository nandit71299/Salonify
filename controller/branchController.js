const path = require('path');
const logger = require('../config/logger');
const { User, Saloon, Branch, BranchHour, sequelize, HolidayHour, PlatformCoupon, PlatformCouponBranch, Services, Rating } = require('../models');
const { Op, fn, col } = require('sequelize');
const enums = require('../enums')
const fs = require('fs');
const moment = require('moment');
const geolib = require('geolib')
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
            logger.error("Error inserting store hours:", error);
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
            logger.error("Error inserting store hours:", error);
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
                    { status: enums.is_active.no },
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
                await HolidayHour.update({ from_date: moment(from_date).format('YYYY-MM-DD HH:mm'), to_date: moment(to_date).format('YYYY-MM-DD HH:mm') }, { where: { branch_id: branch_id, id: id }, returning: true }, { transaction })
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

    },

    async getNearbySalons(req, res) {
        const { city, maxDistance, latitude, longitude } = req.query;
        try {
            // Step 1: Get all salons in the specified city using Sequelize
            const filter = [];

            let filterOption = req.query.filterOption;
            if (filterOption) { filterOption = filterOption.toLowerCase(); }
            if (filterOption) {
                if (filterOption == "unisex") {
                    filter.push(enums.salon_type.unisex);
                }
                if (filterOption == "womens") {
                    filter.push(enums.salon_type.womens);
                }
                if (filterOption == "mens") {
                    filter.push(enums.salon_type.mens);
                }
            }

            const salons = await Branch.findAll({
                where: {
                    city: city,
                    type: filter,
                }
            });
            if (salons.length < 1) {
                return res.status(404).json({
                    success: false,
                    message: "No sign of salons? Maybe they're on vacation, or maybe they're just camera shy! Ask your favorite salon to register with Salonify.",
                    data: []
                })
            }
            // Step 2: Filter salons based on distance using geolib
            const nearbySalons = salons.filter(salon => {
                const distance = geolib.getDistance(
                    { latitude, longitude },
                    { latitude: salon.latitude, longitude: salon.longitude }
                );

                return distance <= maxDistance;
            });
            let data = [];
            for (const salon of nearbySalons) {
                let imagePath = salon.image;
                let contents = null;
                const filePath = path.resolve(__dirname, imagePath);
                if (fs.existsSync(filePath)) {
                    contents = await fs.promises.readFile(filePath, { encoding: 'base64' });
                }
                data.push({
                    id: salon.id,
                    name: salon.name,
                    city: salon.city,
                    address: salon.address,
                    type: salon.type === enums.salon_type.unisex ? "Unisex" : salon.type === enums.salon_type.mens ? "Men's" : salon.type === enums.salon_type.womens ? "Woemn's" : "Unknown",
                    contact: salon.contact,
                    image: contents,
                    seats: salon.seats,
                    status: salon.status
                })
            }

            // Step 3: Return the filtered list of salons
            res.json({ success: true, data: data, message: "OK" });
        } catch (error) {
            // Handle any errors that occur during the query or filtering process
            logger.error('Error fetching nearby salons:', error);
            res.status(500).json({ success: false, message: 'Internal server error', data: [] });
        }
    },

    async getBranchesByCategory(req, res) {
        try {
            const { category_id, city } = req.query;

            // Assuming you have defined the models for 'services' and 'branches' using Sequelize
            const services = await Services.findAll({
                where: { category_id: category_id, status: enums.is_active.yes }
            });

            // Retrieve branch_ids from services
            const branchIds = services.map(service => service.branch_id);

            // Retrieve branches based on branchIds and city
            const branches = await Branch.findAll({
                where: {
                    id: { [Op.in]: branchIds },
                    city: city, // Filter branches by city
                    status: enums.is_active.yes
                }
            });

            if (branches.length === 0) {
                return res.status(404).json({ success: false, data: [], message: "No sign of salons? Maybe they're on vacation, or maybe they're just camera shy! Ask your favorite salon to register with Salonify." });
            }

            res.status(200).json({ success: true, data: branches, message: "OK" });
        } catch (error) {
            logger.error('Error fetching active branches:', error);
            res.status(500).json({ success: false, data: [], message: 'Internal Server Error.' });
        }
    },

    async rateBranch(req, res) {
        const { user_id, branch_id, rating, comment } = req.body;

        const checkUser = await User.findOne({ where: { id: user_id, status: enums.is_active.yes } });
        const checkBranch = await Branch.findOne({ where: { id: branch_id, status: enums.is_active.yes } });

        if (!checkUser || !checkBranch) {
            return res.status(404).json({ success: false, message: "No luck finding that user/branch.", data: [] });
        }

        try {
            const createRating = await Rating.create({
                user_id: user_id,
                module_type: enums.ratingModule.branch,
                module_id: branch_id,
                rating: rating,
                comment: comment,
            }, { returning: true })

            res.status(200).json({
                success: true,
                message: "OK",
                data: createRating.id,
            })
        } catch (error) {
            logger.error("Error Inserting Salon/Branch Rating: ", error);
            return res.status(500).json({
                success: true,
                message: "Internal Server Error",
                data: []
            })
        }

    },

    async getBranchDetails(req, res) {
        const branch_id = req.query.branch_id;

        try {
            let data = {};

            // Fetch branch details using Sequelize
            const branch = await Branch.findOne({
                where: { id: branch_id }
            });

            if (!branch) {
                return res.status(404).json({ success: false, errors: "Salon/Branch not found", data: [] });
            }

            const { saloon_id, name, city_id, address, type, latitude, longitude, seats, status } = branch;

            let branchDetails = {
                saloon_id: saloon_id,
                name: name,
                city_id: city_id,
                address: address,
                type: parseInt(type) === 1 ? "Unisex" : parseInt(type) === 2 ? "Men's" : parseInt(type) === 3 ? "Women's" : "",
                latitude: latitude,
                longitude: longitude,
                status: status
            };

            // Check if BranchDetails exists in data
            if (!data['BranchDetails']) {
                data['BranchDetails'] = [];
            }

            // Push branch details to the array
            data['BranchDetails'].push(branchDetails);

            // Fetch BranchHours for the current branch using Sequelize
            const branchHours = await BranchHour.findAll({
                where: { branch_id: branch_id },
                order: [
                    [sequelize.literal(`CASE day 
                        WHEN 'monday' THEN 1 
                        WHEN 'tuesday' THEN 2 
                        WHEN 'wednesday' THEN 3 
                        WHEN 'thursday' THEN 4 
                        WHEN 'friday' THEN 5 
                        WHEN 'saturday' THEN 6 
                        WHEN 'sunday' THEN 7 
                        END`)]
                ]
            });

            if (branchHours.length > 0) {
                // Initialize BranchHours array if it doesn't exist in data
                if (!data['BranchHours']) {
                    data['BranchHours'] = [];
                }
                for (const hour of branchHours) {
                    const day = hour.day;
                    const start_time = hour.start_time;
                    const end_time = hour.end_time;
                    // Push branch hours to the array
                    let branch_hour = {
                        day: day.charAt(0).toUpperCase() + day.slice(1),
                        start_time: start_time,
                        end_time: end_time
                    };
                    data['BranchHours'].push(branch_hour);
                }
            }

            res.json({ success: true, data: data, message: "OK" });
        } catch (error) {
            logger.error('Error fetching branch details:', error);
            res.status(500).json({ success: false, message: 'Internal server error', data: [] });
        }
    }

}