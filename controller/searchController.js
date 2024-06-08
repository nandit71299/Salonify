const logger = require('../config/logger');
const { User, Saloon, Branch, sequelize, PlatformCouponBranch, Services, ServiceOptions, Rating } = require('../models');
const { Op, fn, col } = require('sequelize');
const enums = require('../enums')


module.exports = {

    async searchServiceOrBranch(req, res) {
        const { searchstring, sortBy, sortOrder, city } = req.query;

        try {
            const services = await Services.findAll({
                where: {
                    status: enums.is_active.yes,
                    name: {
                        [Op.iLike]: `%${searchstring}%`
                    }
                },
                include: [
                    {
                        model: Branch,
                        where: { status: enums.is_active.yes, city: city },
                        attributes: ['id', 'name', 'address']
                    },
                    {
                        model: ServiceOptions,
                        where: { status: enums.is_active.yes },
                        attributes: []
                    },
                    {
                        model: Rating,
                        where: { module_type: enums.ratingModule.branch }, // Assuming 1 represents branches
                        required: false, // Use required: false to perform a LEFT JOIN
                        attributes: [[sequelize.fn('AVG', sequelize.col('rating')), 'average_branch_rating']]
                    },
                    {
                        model: Rating,
                        where: { module_type: enums.ratingModule.service }, // Assuming 2 represents service options
                        required: false, // Use required: false to perform a LEFT JOIN
                        attributes: [[sequelize.fn('AVG', sequelize.col('rating')), 'average_service_option_rating']]
                    }
                ],
                attributes: {
                    include: ['id',
                        [sequelize.fn('MIN', sequelize.col('ServiceOptions.duration')), 'lowest_duration'],
                        [sequelize.fn('MAX', sequelize.col('ServiceOptions.duration')), 'largest_duration'],
                        [sequelize.fn('MIN', sequelize.col('ServiceOptions.price')), 'lowest_price'],
                    ],
                },
                group: ['Services.id', 'Branch.id', 'Ratings.id',],
            });

            const result = services.map(service => {
                const branch = service.Branch;
                const averageBranchRating = service.Ratings.length > 0 ? parseFloat(service.Ratings[0].getDataValue('average_branch_rating')).toFixed(2) : null;
                const averageServiceOptionRating = service.Ratings.length > 1 ? parseFloat(service.Ratings[1].getDataValue('average_service_option_rating')).toFixed(2) : null;
                return {
                    service_id: service.id,
                    branch_id: branch.id,
                    branch_name: branch.name,
                    branch_address: branch.address,
                    average_branch_rating: averageBranchRating,
                    service_id: service.id,
                    service_name: service.name,
                    lowest_duration: service.getDataValue('lowest_duration'),
                    largest_duration: service.getDataValue('largest_duration'),
                    lowest_price: service.getDataValue('lowest_price'),
                    average_service_option_rating: averageServiceOptionRating
                };
            });

            // Sorting
            if (sortBy && sortOrder) {
                result.sort((a, b) => {
                    if (sortBy === 'price') {
                        return sortOrder === 'asc' ? a.lowest_price - b.lowest_price : b.lowest_price - a.lowest_price;
                    } else if (sortBy === 'duration') {
                        return sortOrder === 'asc' ? a.lowest_duration - b.lowest_duration : b.lowest_duration - a.lowest_duration;
                    }
                });
            }

            const branchesMap = {};
            const servicesFormatted = [];

            result.forEach(row => {
                const branchId = row.branch_id;
                if (!branchesMap[branchId]) {
                    branchesMap[branchId] = {
                        branch_id: branchId,
                        branch_name: row.branch_name,
                        branch_address: row.branch_address,
                        average_branch_rating: row.average_branch_rating
                    };
                }
                servicesFormatted.push({
                    service_id: row.service_id, // Include Service table's id
                    branch_id: branchId,
                    branch_name: row.branch_name,
                    branch_address: row.branch_address,
                    service_name: row.service_name,
                    timings: {
                        lowest: row.lowest_duration,
                        largest: row.largest_duration
                    },
                    lowest_price: row.lowest_price,
                    average_service_option_rating: row.average_service_option_rating
                });
            });

            const branches = Object.values(branchesMap);
            const searchResult = { services: servicesFormatted, branches };

            res.json({ success: true, data: searchResult, message: "OK" });
        } catch (error) {
            logger.error('Error fetching service details:', error);
            res.status(500).json({ success: false, message: 'Internal Server Error.', data: [] });
        }
    }
}