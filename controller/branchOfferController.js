const { PlatformCouponBranch, PlatformCoupon, BranchCoupon, sequelize } = require('../models');
const enums = require('../enums')
const moment = require('moment');
const logger = require('../config/logger');
const { Op, fn, col, where } = require('sequelize');

module.exports = {
    //TODO Continue getBranchOffers
    async getAllBranchOffers(req, res) {

        const branch_id = req.query.branch_id;
        const data = { platform_coupons: [], branch_coupons: [] };

        try {
            const getPlatformOffers = await PlatformCouponBranch.findAll({
                attributes: ['platform_coupon_id', 'branch_id'],
                where: {
                    branch_id: branch_id
                },
                include: [{
                    model: PlatformCoupon,
                    as: 'coupon',
                    attributes: ['amount', 'remark', 'max_advance_payment']
                }]
            });

            if (getPlatformOffers) {
                data.platform_coupons = getPlatformOffers.map(pcb => ({
                    coupon_type: enums.coupon_type.platform_coupon,
                    platform_coupon_id: pcb.platform_coupon_id,
                    branch_id: pcb.branch_id,
                    discount_amount: pcb.coupon.amount,
                    remark: pcb.coupon.remark,
                    max_advance_payment: pcb.coupon.max_advance_payment
                }));
            }

            const getBranchOffers = await BranchCoupon.findAll({ where: { branch_id: branch_id, status: enums.is_active.yes } })
            if (getBranchOffers) {
                data.branch_coupons = getBranchOffers.map(bc => ({
                    coupon_type: enums.coupon_type.branch_coupon,
                    id: bc.id,
                    name: bc.name,
                    status: bc.status,
                    amount: bc.amount,
                    max_advance_amount: bc.max_advance_amount,
                    advance_percentage: bc.advance_percentage,
                    minimum_order_subtotal: bc.minimum_subtotal,
                    start_date: bc.start_date,
                    end_date: bc.end_date,
                    remark: bc.remark
                }))
            }

            res.json({ success: true, data: data, message: "OK" });


        } catch (error) {
            logger.error("Error Fetching Branch Offers: ", error)
            res.status(500).json({ success: false, message: "Internal Server Error", data: [] });
        }

    },

    async createOffer(req, res) {
        const { remark, branch_id, discount_amount, minimum_order_subtotal, name, from_date, to_date, coupon_status, max_advance_amount, advance_percentage } = req.body;

        try {
            const findBranch = await BranchCoupon.findOne({ where: { id: branch_id, status: enums.is_active.yes } })
            if (!findBranch) {
                return res.status(404).json({ success: false, message: "Salon/Branch Not Found", data: [] });
            }
            const createCoupon = await BranchCoupon.create({
                branch_id,
                name,
                status: coupon_status,
                amount: discount_amount,
                max_advance_amount,
                advance_percentage,
                minimum_subtotal: minimum_order_subtotal,
                start_date: from_date,
                end_date: to_date,
                remark
            }, { returning: true })

            if (!createCoupon) {
                res.status(400).json({ success: false, message: "Error Creating Coupon", data: [] });
            }

            res.json({ success: true, message: "OK", data: createCoupon })
        } catch (error) {
            logger.error("Error Creating Offer: ", error);
            res.status(500).json({ success: false, message: "Internal Server Error", data: [] });
        }
    },

    async getBranchOfferDetails(req, res) {
        const { branch_id, id } = req.query;
        try {
            const data = await BranchCoupon.findOne({ where: { branch_id: branch_id, id } })
            res.json({ success: true, message: "OK", data: data });

        } catch (error) {
            logger.error("Error fetching branch offer details: ", error);
            res.status(500).json({ success: false, message: "Internal Server Error", data: [] });
        }
    }
}
