const { Cart, CartItems, ServiceOptions, sequelize } = require('../models');
const { Op, fn, col } = require('sequelize');
const enums = require('../enums')
const logger = require('../config/logger')


module.exports = {
    async addToCart(req, res) {
        const { user_id, branch_id, service_option_id } = req.body;

        try {
            // Check if there is any cart exists for the user
            const existingCart = await Cart.findOne({ where: { user_id: user_id } });

            if (existingCart) {
                // Cart exists for the user
                const cartBranchId = existingCart.branch_id;

                // Check if the cart branch is the same as the branch user is adding services for
                if (cartBranchId === parseInt(branch_id)) {
                    // Insert services to cart_items, skipping those that already exist
                    const existingService = await CartItems.findOne({ where: { cart_id: existingCart.id, service_option_id: service_option_id } });
                    if (!existingService) {
                        const serviceDetails = await ServiceOptions.findOne({ where: { id: service_option_id, status: enums.is_active.yes } });

                        if (serviceDetails) {
                            await CartItems.create({
                                cart_id: existingCart.id,
                                service_option_id: service_option_id,
                            });
                            return res.json({ success: true, message: "Services added to the cart successfully.", data: [] });
                        } else {
                            // Handle the case where no valid service is found in the services_options table
                            return res.status(404).json({
                                success: false,
                                message: "Service does not exist or may have been deleted.",
                                data: []
                            });
                        }
                    } else {
                        return res.status(409).json({ success: false, message: "Service already exists in the cart.", data: [] });
                    }
                } else {
                    // Cart branch does not match the branch user is adding services for
                    return res.status(400).json({ success: false, message: "Cannot add services to cart. Cart belongs to a different branch.", data: [] });
                }
            } else {
                const serviceDetails = await ServiceOptions.findOne({ where: { id: service_option_id, status: enums.is_active.yes } });

                if (serviceDetails) {
                    const newCart = await Cart.create({
                        user_id: user_id,
                        branch_id: branch_id,
                    }, { returning: true })
                    const cartId = newCart.id;

                    const insertCartItems = await CartItems.create({ cart_id: cartId, service_option_id: service_option_id });

                    return res.json({ success: true, message: "Services added to the cart successfully.", data: [] });
                } else {
                    // Handle the case where no valid service is found in the services_options table
                    return res.status(404).json({
                        success: false,
                        message: "Service does not exist or may have been deleted.",
                        data: []
                    });
                }
            }
        } catch (error) {
            logger.error("Error adding services to cart:", error);
            return res.status(500).json({ success: false, message: "Internal Server Error.", data: [] });
        }
    },

    async removeFromCart(req, res) {
        const { user_id, branch_id } = req.body;
        const serviceOptionId = req.body.service_option_id;

        try {
            // Check if the cart item exists and belongs to the specified user and branch
            const existingCartItem = await CartItems.findOne({
                include: [{
                    model: Cart,
                    where: {
                        user_id: user_id,
                        branch_id: branch_id
                    }
                }],
                where: {
                    service_option_id: serviceOptionId
                }
            });
            if (existingCartItem) {
                // Remove the cart item
                await CartItems.destroy({ where: { id: existingCartItem.id, service_option_id: serviceOptionId } })
                return res.json({ success: true, message: "Cart item removed successfully.", data: [] });
            } else {
                // Cart item not found or does not belong to the specified user and branch
                return res.status(404).json({ success: false, message: "Cart item not found.", data: [] });
            }
        } catch (error) {
            logger.error("Error removing cart item:", error);
            return res.status(500).json({ success: false, message: "Internal Server Error.", data: [] });
        }
    },

    async cartDeleteAll(req, res) {
        const userId = req.body.user_id;
        const transaction = await sequelize.transaction();
        try {

            const cartQuery = await Cart.findOne({ where: { user_id: userId }, transaction });

            if (!cartQuery) {
                return res.status(404).json({ success: false, message: 'Cart not found.' });
            }

            const cartId = cartQuery.id;

            await CartItems.destroy({
                where: { cart_id: cartId }
            }, { transaction })

            await Cart.destroy({
                where: { id: cartId }
            }, { transaction })

            await transaction.commit();
            res.json({ success: true, message: 'Cart deleted successfully.', data: [] });
        } catch (error) {
            await transaction.rollback();
            logger.error('Error deleting cart:', error);
            res.status(500).json({ success: false, message: 'Internal Server Error.', data: [] });
        }

    },

    async getCartCount(req, res) {
        const user_id = req.query.user_id;

        try {
            // Query to get the number of items and branch_id associated with the user's cart
            const cartDetails = await CartItems.findAll({
                include: [{
                    model: Cart,
                    where: { user_id: user_id },
                    attributes: ['branch_id']
                }],
                attributes: [[sequelize.fn('COUNT', sequelize.col('CartItems.id')), 'item_count'],
                    'Cart.branch_id'],
                group: ['Cart.branch_id', 'Cart.id']
            })

            if (cartDetails.length < 1) {

                return res.status(200).json({ success: true, data: [], message: "OK" });
            }

            // Extract the item count and branch_id from the result
            const data = cartDetails.map(item => ({
                item_count: parseInt(item.getDataValue('item_count')),
                branch_id: item.getDataValue('Cart').branch_id
            }));

            res.status(200).json({ success: true, data: data, message: "OK" });
        } catch (error) {
            logger.error('Error fetching cart item count:', error);
            res.status(500).json({ success: false, data: [], message: 'Internal Server Error.' });
        }

    }
}