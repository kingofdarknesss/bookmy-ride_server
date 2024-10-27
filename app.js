import express from "express";
import dbConnection from "./src/config/dbConnection.js";
import mongoose from "mongoose";
import { PORT } from "./src/utils/constant.js";
import userRouter from "./src/auth/routes/user.routes.js";
import cors from "cors";
import { FRONTEND_URL } from "./src/utils/constant.js";
import cookieParser from "cookie-parser";
import tripRouter from "./src/trip/routes/trips.routes.js";
import bookingRouter from "./src/Booking/routes/booking.routes.js";
import Trip from "./src/trip/model/trips.model.js";
const app = express();

app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(cookieParser());

app.use("/user", userRouter);
app.use("/trip", tripRouter);
app.use("/book", bookingRouter);
const clearExpiredReservations = async () => {
  const currentTime = new Date();

  try {
    // Only find trips with seats that are reserved and where reservationExpiresAt < currentTime
    const trips = await Trip.find({
      "seats.reserved": true,
      "seats.reservationExpiresAt": { $lt: currentTime },
    });

    for (const trip of trips) {
      let hasUpdated = false;

      for (const row of trip.seats) {
        row.forEach((seat) => {
          if (seat.reserved && seat.reservationExpiresAt < currentTime) {
            seat.reserved = false;
            seat.reservedBy = null;
            seat.reservationExpiresAt = null;
            hasUpdated = true;
          }
        });
      }

      if (hasUpdated) {
        await trip.save();
      }
    }
  } catch (error) {
    console.error("Error clearing expired reservations:", error);
  }
};
// Run this job every 30 seconds
setInterval(clearExpiredReservations, 30000);

dbConnection()
  .then(() => {
    app.listen(PORT || 4000, () => {
      console.log(`Server is running on port ${PORT || 4000}`);
    });
  })
  .catch((error) => {
    console.error(
      "Server failed to start due to database connection error:",
      error.message
    );
    process.exit(1); // Gracefully exit the server on DB connection failure
  });

// Handle graceful shutdown
process.on("SIGINT", async () => {
  console.log("Shutting down server...");
  await mongoose.connection.close();
  console.log("Database connection closed.");
  process.exit(0);
});
