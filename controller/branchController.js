module.exports = {

    async test(req, res) {
        try {
            res.send("DONE")

        } catch (error) {
            res.send(error)
        }
    }
}