'use strict';

const path = require('path');
const { getBranchTypeByValue } = require(path.join(path.dirname(require.main.filename), 'app', 'enums', 'branch', 'Types.js'));

class RegistrationResource {
    constructor(saloon, branch) {
        this.saloon = saloon;
        this.branch = branch;
    }

    toArray() {
        return {
            saloon_name: this.saloon.name,
            saloon_description: this.saloon.description,
            branch_name: this.branch.name,
            branch_city: this.branch.city,
            branch_address: this.branch.address,
            branch_type: getBranchTypeByValue(parseInt(this.branch.type)),
            branch_contact: this.branch.contact,
            branch_latitude: this.branch.latitude,
            branch_longitude: this.branch.longitude,
            branch_seats: this.branch.seats,
        };
    }
}

module.exports = RegistrationResource;
