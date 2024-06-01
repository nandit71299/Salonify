'use strict';

class SaloonResource {
    constructor(saloon) {
        this.saloon = saloon;
    }

    toArray() {
        return {
            id: this.saloon.id,
            name: this.saloon.name,
            description: this.saloon.description,
        };
    }
}

module.exports = SaloonResource;
