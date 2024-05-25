'use strict';

class UserResource {
    constructor(user) {
        this.user = user;
    }

    toArray() {
        return {
            id: this.user.id,
            name: this.user.name,
            email: this.user.email,
            phone_number: this.user.phone_number,
            date_of_birth: this.user.date_of_birth,
        };
    }
}

module.exports = UserResource;
