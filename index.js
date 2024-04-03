import express from "express";
import bodyParser from "body-parser";
// import customerRoutes from "./routes/customerRoutes.js"
// import salonRoutes from "./routes/salonRoutes.js"
// import paymentRoutes from "./routes/paymentRoutes.js"
// import appointmentRoutes from "./routes/appointmentRoutes.js";
// import serviceRoutes from "./routes/serviceRoutes.js";
import salonowners from "./routes/salonowners.js";
import salonifycustomers from "./routes/salonifycustomers.js"
import dotenv from "dotenv";

dotenv.config();
export const app = express();
const port = process.env.port;



app.use(bodyParser.urlencoded({ extended: true, }));

// Index Route
app.get("/", (req, res) => {
    res.render("index.ejs")
})


// app.use('/api/customer/', customerRoutes);

// app.use('/api/salon', salonRoutes);

// app.use('/api/appointment',appointmentRoutes);

// app.use('/api/payment',paymentRoutes);

// app.use('/api/services',serviceRoutes);


app.use('/api/owners', salonowners);

app.use('/api/customers', salonifycustomers);









app.listen(port, () =>
    console.log("Server is running on port" + port)
)