const { Category, sequelize } = require('../models');
const fs = require('fs');
const path = require('path');
const logger = require('../config/logger');

module.exports = {
    async getCategories(req, res) {

        try {
            const getCategories = await Category.findAll();
            if (!getCategories) {
                return res.status(404).json({
                    success: true,
                    message: "No Categories Found",
                    data: []
                })
            }
            const categoryData = getCategories.map(getCategories => getCategories.toJSON());
            let categories = []
            for (const category of categoryData) {
                let imagePath = category.image;
                const filePath = path.resolve(__dirname, imagePath);
                const contents = await fs.promises.readFile(filePath, { encoding: 'base64' });
                categories.push({ id: category.id, name: category.name, image: contents });
            }

            res.status(200).json({
                success: true,
                data: categories,
                message: "OK",
            })
        } catch (error) {
            logger.error("Error Fetching Categories: ", error);
            res.status(500).json({ success: false, message: "Internal Server Error", error: 'error', data: [] });
        }
    }
}