const { User, Saloon, Branch, sequelize, Services, ServiceOptions, AdditionalInformation, Category, Department, Sequelize } = require('../models');
const logger = require('../config/logger');
const moment = require('moment')
const enums = require('../enums')
moment.tz("Asia/Kolkata");

module.exports = {
    async createService(req, res) {
        const jsonData = req.body;
        let service_id; // Declare the variable outside the transaction block

        const checkBranchExistence = await Branch.findOne({ where: { id: jsonData.branch_id } });
        if (!checkBranchExistence) {
            return res.status(404).json({
                success: false,
                message: "Salon/Branch not found",
                data: [],
            });
        }

        try {
            const { service_name, branch_id, category_id, description, department_id, service_options, additional_information } = jsonData;

            const checkCategory = await Category.findOne({ where: { id: category_id } });
            if (!checkCategory) {
                return res.status(404).json({
                    success: false,
                    message: "Selected Category Not Found. Please Choose Different Category Or Contact Customer Support ",
                    data: [],
                });
            }

            const checkDepartment = await Department.findOne({ where: { id: department_id } });
            if (!checkDepartment) {
                return res.status(404).json({
                    success: false,
                    message: "Selected Department Not Found. Please Choose Different Department or Contact Customer Support ",
                    data: [],
                });
            }

            // Start a managed transaction
            const transact = await sequelize.transaction(async (transaction) => {
                const insertService = await Services.create(
                    {
                        name: service_name,
                        branch_id: branch_id,
                        category_id: category_id,
                        description: description,
                        department_id: department_id,
                        status: 1
                    },
                    { returning: ['id'], transaction }
                );

                service_id = insertService.id; // Assign the value within the transaction block

                for (const option of service_options) {
                    const { name, discount, price, description, duration } = option;
                    await ServiceOptions.create(
                        {
                            service_id: service_id,
                            name: name,
                            discount: discount,
                            price: price,
                            description: description,
                            duration: duration,
                            status: enums.is_active.yes
                        },
                        { transaction }
                    );
                }

                for (const element of additional_information) {
                    const { title, description } = element;
                    const createAdditionalInformation = await AdditionalInformation.create(
                        {
                            title: title,
                            description: description,
                            service_id: service_id
                        },
                        { transaction }
                    );
                    await Services.update(
                        { additional_information_id: createAdditionalInformation.id },
                        { where: { id: service_id }, transaction }
                    );
                }
            });

            res.status(200).json({ success: true, data: [{ service_id: service_id }], message: "Service Created Successfully" });
        } catch (err) {
            logger.error("Error Creating Service: ", err);
            res.status(500).json({ success: false, message: "Internal Server Error", data: [] });
        }
    },

    async getAllService(req, res) {
        const branch_id = req.query.branch_id;
        const checkBranchExistence = await Branch.findOne({ where: { id: branch_id, status: 1 } });
        if (!checkBranchExistence) {
            return res.status(404).json({
                success: false,
                message: "Salon/Branch Not Found.",
                data: [],
            })
        }
        const services = []
        const data = { services }
        try {
            const getAllServices = await Services.findAll(
                {
                    attributes: ['id', 'name', 'branch_id', 'category_id', 'description', 'department_id'],
                    where: { branch_id: branch_id, status: 1 }
                }
            )
            if (getAllServices.length === 0) {
                return res.json({ success: true, message: "No Services Found.", data: [] })
            }
            for (const iterator of getAllServices) {
                const { id, name, branch_id, category_id, description } = iterator;

                const category = await Category.findOne({ attributes: ['name'], where: { id: category_id } });
                const department = await Department.findOne({ attributes: ['name'], where: { id: iterator.department_id } });
                if (!category) {
                    return res.status(404).json({ success: false, message: "Error fetching one or more service details. Please contact Salonify", data: [] })
                }
                if (!department) {
                    return res.status(404).json({ success: false, message: "Error fetching one or more service details. Please contact Salonify", data: [] })
                }
                services.push({
                    id: id,
                    name: name,
                    branch_id: branch_id,
                    category_id: category_id,
                    category: category.name,
                    department: department.name,
                    description: description,
                })
            }


            res.status(200).json({ success: true, data: data, message: "OK" })

        }
        catch (error) {
            logger.error("Error Fetching Services: ", error);
            res.status(500).json({
                success: false,
                message: "Internal Server Error Occured",
                data: []
            })
        }
    },

    async deleteServices(req, res) {
        const jsonData = req.body;

        const branch_id = jsonData.branch_id;
        const service_ids = jsonData.service_ids;
        const dbServices = [];

        const checkBranchExistence = await Branch.findOne({ where: { id: branch_id, status: 1 } });
        if (!checkBranchExistence) {
            return res.status(404).json({
                success: false,
                message: "Salon/Branch Not Found.",
                data: [],
            })
        }

        const getBranchServices = await Services.findAll({ attributes: ['id'], where: { branch_id: branch_id, status: 1 } })
        for (const service of getBranchServices) {
            dbServices.push(service.id);
        }
        const nonExistentServices = service_ids.filter(service => !dbServices.includes(service));

        if (nonExistentServices.length > 0) {
            return res.status(404).json({
                success: false,
                message: "One or more Service is either deleted or does'nt exists",
                data: []
            })
        }
        try {
            await sequelize.transaction(async (transaction) => {
                for (const service of service_ids) {
                    await Services.update(
                        {
                            status: 0
                        },
                        { where: { id: service } }
                    )
                }
            })

            res.status(200).json({
                success: true,
                message: "Services Deleted Successfully",
                data: [],
            })
        } catch (error) {
            logger.error("Error Deleting Service: ", error);
            res.status(500).json({
                success: false,
                message: "Internal Server Error Occured",
                data: []
            })
        }
    },

    async updateService(req, res) {
        const serviceId = req.body.service_id;
        const jsonData = req.body;
        const branch_id = req.body.branch_id;
        const checkBranchExistence = await Branch.findOne({ where: { id: parseInt(branch_id) } });
        if (!checkBranchExistence) {
            return res.status(404).json({
                success: false,
                message: "Error Fetching Salon/Branch Details.",
                data: [],
            })
        }

        try {
            if (Object.keys(jsonData).length === 0) {
                return res.status(400).json({ success: false, message: "No data provided for updating service.", data: [] });
            }

            // Check if the provided service_id exists
            const checkServiceExists = await Services.findOne({ where: { id: serviceId, status: 1 }, attributes: ['id'] });
            if (!checkServiceExists) {
                return res.status(404).json({ success: false, message: "Service is either deleted or not found.", data: [] });
            }

            // Start a transaction
            await sequelize.transaction(async (transaction) => {
                // Update service details
                const updateData = {};
                if (jsonData.service_name) updateData.name = jsonData.service_name;
                if (jsonData.category_id) updateData.category_id = jsonData.category_id;
                if (jsonData.description) updateData.description = jsonData.description;

                if (Object.keys(updateData).length > 0) {
                    await Services.update(updateData, {
                        where: { id: serviceId },
                        transaction
                    });
                }

                // Update or insert service options
                if (jsonData.service_options && jsonData.service_options.length > 0) {
                    for (const option of jsonData.service_options) {
                        if ('id' in option) {
                            // If service option ID is provided, update existing option

                            await ServiceOptions.update({
                                name: option.name,
                                discount: option.discount,
                                price: option.price,
                                description: option.description,
                                duration: option.duration
                            }, {
                                where: { id: option.id, status: 1 },
                                transaction
                            });
                        } else {
                            // If service option ID is not provided, insert new option
                            await ServiceOptions.create({
                                service_id: serviceId,
                                name: option.name,
                                discount: option.discount,
                                price: option.price,
                                description: option.description,
                                duration: option.duration,
                                status: 1
                            }, { transaction });
                        }
                    }
                }

                // Update or insert additional information
                if (jsonData.additional_information && jsonData.additional_information.length > 0) {
                    for (const element of jsonData.additional_information) {
                        if ('id' in element) {
                            // If additional information ID is provided, update existing information
                            const checkExistence = await AdditionalInformation.findOne({
                                where: { id: element.id },
                                transaction
                            });
                            if (checkExistence) {
                                await AdditionalInformation.update({
                                    title: element.title,
                                    description: element.description
                                }, {
                                    where: { id: element.id },
                                    transaction
                                });
                            } else {
                                return res.json({ success: false, message: `Additional Information with ID ${element.id} not found.`, data: [] });
                            }
                        } else {
                            // If additional information ID is not provided, insert new information
                            await AdditionalInformation.create({
                                title: element.title,
                                description: element.description,
                                service_id: serviceId
                            }, { transaction });
                        }
                    }
                }

                // Commit the transaction
                res.status(200).json({ success: true, message: "Service updated successfully.", data: [] });
            });
        } catch (error) {
            logger.error("Error updating service:", error);
            res.status(500).json({ success: false, message: "Error updating service.", data: [] });
        }
    },

    async getService(req, res) {
        try {
            const branch_id = req.query.branch_id;
            const service_id = req.query.service_id;

            const checkBranchExistence = await Branch.findOne({ where: { id: branch_id, status: 1 } });
            if (!checkBranchExistence) {
                return res.status(404).json({
                    success: false,
                    message: "Error Fetching Salon/Branch Details.",
                    data: [],
                })
            }


            const serviceData = []
            const getServiceDetails = await Services.findOne({ where: { branch_id, id: service_id, status: 1 }, attributes: ['id', 'name', 'category_id', 'department_id', 'description'] });
            if (!getServiceDetails) {
                return res.status(404).json({
                    success: false,
                    message: "Service does not exist or may have been deleted.",
                    data: []
                })
            }

            const getCategoryName = await Category.findOne({ where: { id: getServiceDetails.category_id } });
            const getDepartmentName = await Department.findOne({ where: { id: getServiceDetails.department_id } });
            serviceData.push(
                {
                    id: getServiceDetails.id,
                    name: getServiceDetails.name,
                    category: getCategoryName ? getCategoryName.name : null,
                    department: getDepartmentName ? getDepartmentName.name : null,
                }
            );

            const getServiceOptions = await ServiceOptions.findAll({ where: { service_id, status: 1 }, attributes: ['id', 'service_id', 'name', 'price', 'discount', 'description', 'duration'] });
            if (!getServiceOptions) {
                return res.status(404).json({
                    success: false,
                    message: "Error Fetching Service Options.",
                    data: []
                })
            }



            const getServiceAdditionalInformations = await AdditionalInformation.findAll({ where: { service_id: service_id, status: 1 }, attributes: ['id', 'title', 'description'] });

            const data = { service_details: serviceData, services_options: getServiceOptions, additional_information: getServiceAdditionalInformations }

            res.status(200).json({ success: true, data: data, message: "OK" });
        }
        catch (error) {
            logger.error("Error updating service:", error);
            res.status(500).json({ success: false, message: "Error updating service.", data: [] });
        }
    },


    async getBranchServices(req, res) {
        const branch_id = req.query.branch_id;
        const sortingOption = req.query.sortingOption;
        const sortingMethod = req.query.sortingMethod;

        try {
            let data = {};

            // Fetch all departments
            const departments = await Department.findAll();

            for (const department of departments) {
                const departmentName = department.name;
                data[departmentName] = {};

                // Fetch services for the current department
                const services = await Services.findAll({
                    where: {
                        branch_id: branch_id,
                        department_id: department.id,
                        status: enums.is_active.yes
                    },
                    include: [
                        {
                            model: ServiceOptions,
                            where: { status: enums.is_active.yes },
                            required: false
                        },
                        {
                            model: AdditionalInformation,
                            where: { status: enums.is_active.yes },
                            required: false
                        }
                    ]
                });

                for (const service of services) {
                    const categoryId = service.category_id;

                    // Fetch category name for the current service
                    const category = await Category.findOne({
                        where: { id: categoryId }
                    });

                    const categoryName = category.name;

                    // Sort service options if sorting parameters are provided
                    let serviceOptions = service.ServiceOptions;
                    if (sortingOption && sortingMethod) {
                        serviceOptions = serviceOptions.sort((a, b) => {
                            if (sortingMethod === 'asc') {
                                return a.price - b.price;
                            } else if (sortingMethod === 'desc') {
                                return b.price - a.price;
                            } else {
                                return 0;
                            }
                        });
                    }

                    // Skip adding service if it doesn't have any service options
                    if (serviceOptions.length === 0) {
                        continue;
                    }

                    // Initialize the category if it doesn't exist
                    if (!data[departmentName][categoryName]) {
                        data[departmentName][categoryName] = [];
                    }

                    // Add service with its options to the category
                    data[departmentName][categoryName].push({
                        service_id: service.id,
                        service_name: service.name,
                        service_description: service.description,
                        additional_information: service.AdditionalInformations,
                        service_options: serviceOptions
                    });
                }
            }

            res.json({ success: true, data: data, message: "OK" });
        } catch (error) {
            logger.error('Error fetching services:', error);
            res.status(500).json({ success: false, data: [], message: 'Internal server error' });
        }
    }

}



