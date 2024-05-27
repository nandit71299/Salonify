const { PlatformCouponBranch, PlatformCoupon, sequelize } = require('../models');
const moment = require('moment');
const logger = require('../config/logger');
const { Op, fn, col } = require('sequelize');

module.exports = {
    //TODO Continue getBranchOffers
    async getBranchOffers(req, res) {

        const branch_id = req.query.branch_id;
        const data = { coupons: [] };

        try {
            const getOffers = await PlatformCouponBranch.findAll({
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

            if (getOffers) {
                data.coupons = getOffers.map(pcb => ({
                    platform_coupon_id: pcb.platform_coupon_id,
                    branch_id: pcb.branch_id,
                    discount_amount: pcb.coupon.amount,
                    remark: pcb.coupon.remark,
                    max_advance_payment: pcb.coupon.max_advance_payment
                }));
            }

            res.json({ success: true, data: data, message: "OK" });


        } catch (error) {
            logger.error("Error Fetching Branch Offers: ", error)
            res.status(500).json({ success: false, message: "Internal Server Error", data: [] });

        }

    }
}
