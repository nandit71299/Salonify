const EmployeeType = {
    owner: 1,
    employee: 2,
    hairstylist: 3
}

const UserType = {
    customer: 1,
    salon_admin: 2,
}

const is_active = {
    yes: 1,
    no: 0,
}

const appointmentType = {
    Pending_Payment_Confirmation: 1,
    Confirmed: 2,
    Closed: 3,
    Cancelled: 4,
    NoShow: 5,
}

const advance_payment_type = {
    regular: 1,
    offer: 2
}

const advance_payment_amount_type = {
    percentage: 1,
    fixed: 2
}

const salon_type = {
    unisex: 1,
    mens: 2,
    womens: 3
}

const wishlist_type = {
    service: 1,
    branch: 2
}

const payment_status = {
    succesfull: 1,
    failed: 2,
    refunded: 3
}

const coupon_type = {
    platform_coupon: 1,
    branch_coupon: 2
}
export { EmployeeType, UserType, is_active, appointmentType, salon_type, wishlist_type, payment_status };