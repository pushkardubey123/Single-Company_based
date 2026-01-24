const mongoose = require("mongoose");
require("dotenv").config();
const dns = require("dns");

dns.setDefaultResultOrder("ipv4first");

const dbConnect = async () => {
  try {
    const URI = process.env.MONGO_URL; 

    await mongoose.connect(URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      tls: true, 
    });

    console.log("MongoDB Connected Successfully!");

    mongoose.connection.on("disconnected", () => {
      console.warn("MongoDB Disconnected!");
    });

  } catch (error) {
    console.error(" MongoDB Connection Error:", error);
    process.exit(1);
  }
};

module.exports = dbConnect;
