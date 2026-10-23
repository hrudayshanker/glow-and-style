const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Serve website files from the Public folder.
app.use(express.static(path.join(__dirname, "Public")));

app.get("/api", (req, res) => {
    res.json({
        message: "Your Salon Booking Website backend is working!"
    });
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
});