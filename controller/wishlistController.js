const { Wishlist, Branch, Services, User, Sequelize } = require('../models');
const logger = require('../config/logger');
const moment = require('moment')
const enums = require('../enums')

module.exports = {
    async createOrUpdateWishlist(req, res) {
        try {
            const { user_id, type_id, wishlist_type } = req.body;

            const checkUser = await User.findOne({
                where: { id: user_id }
            })

            if (!checkUser) {
                return res.status(404).json({
                    success: false,
                    message: "Looks like you are wishlisting anonymously. Just Kidding."
                })
            }

            if (parseInt(wishlist_type) === enums.wishlist_type.branch) {
                const checkExistence = await Branch.findOne({ where: { id: type_id, status: enums.is_active.yes } })
                if (!checkExistence) {
                    return res.status(404).json({
                        success: false,
                        message: "Salon/Branch not found."
                    })
                }
            }
            if (parseInt(wishlist_type) === enums.wishlist_type.service) {
                const checkExistence = await Services.findOne({ where: { id: type_id, status: enums.is_active.yes } })
                if (!checkExistence) {
                    return res.status(404).json({
                        success: false,
                        message: "Service not found."
                    })
                }
            }

            // Check if a row exists for the given user, wishlist type, and type ID
            const existingRow = await Wishlist.findOne({
                where: {
                    user_id: user_id,
                    wishlist_type: wishlist_type,
                    type_id: type_id
                }
            });

            let statusToUpdate;
            if (existingRow) {
                // Toggle the status
                const currentStatus = existingRow.status;
                statusToUpdate = currentStatus === enums.is_active.no ? enums.is_active.yes : enums.is_active.no;

                // Update the row in the database with the new status
                if (statusToUpdate === enums.is_active.no) {
                    // Set deleted_at to current timestamp
                    await existingRow.update({
                        status: statusToUpdate,
                        deleted_at: moment.now()
                    });
                } else {
                    await existingRow.update({
                        status: statusToUpdate,
                        deleted_at: null
                    });
                }

            } else {
                // If the row does not exist, insert a new row with status 1
                statusToUpdate = 1;
                await Wishlist.create({
                    user_id: user_id,
                    wishlist_type: wishlist_type,
                    type_id: type_id,
                    status: statusToUpdate
                });
            }

            res.json({ success: true, data: [{ status: statusToUpdate }], message: "OK" });
        } catch (error) {
            logger.error('Error updating wishlist:', error);
            res.status(500).json({ success: false, message: 'Internal server error', data: [] });
        }
    },

    async getAllWishlistedItems(req, res) {
        try {
            const user_id = req.query.user_id;

            // Fetch wishlist items
            const wishlistData = await Wishlist.findAll({
                where: { user_id },
                attributes: ['type_id', 'wishlist_type']
            });

            if (wishlistData.length === 0) {
                return res.status(404).json({ success: true, message: "No Wishlisted Items Found.", data: [] });
            }

            const data = {
                services: [],
                branches: []
            };

            // Process wishlist items
            for (const item of wishlistData) {
                if (item.wishlist_type === enums.wishlist_type.service) {
                    const service = await Services.findOne({
                        where: { id: item.type_id, status: 1 }
                    });
                    if (service) {
                        data.services.push(service);
                    }
                } else if (item.wishlist_type === enums.wishlist_type.branch) {
                    const branch = await Branch.findOne({
                        where: { id: item.type_id, status: 1 }
                    });
                    if (branch) {
                        data.branches.push(branch);
                    }
                }
            }

            res.json({ success: true, data });
        } catch (error) {
            logger.error("Error fetching wishlist items:", error);
            res.status(500).json({
                success: false,
                message: "Internal Server Error",
                data: []
            });
        }

    }
}