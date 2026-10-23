const express = require("express");
const path = require("path");

const app = express();
const PORT = 3000;

// Allow the server to receive JSON data
app.use(express.json());

// Serve website files from the public folder
app.use(express.static(path.join(__dirname, "public")));

// Test the backend
app.get("/api", (req, res) => {
res.json({
message: "Your Salon Booking Website backend is working!"
});
});

// Start the server
app.listen(PORT, () => {
console.log(`Server running at http://localhost:${PORT}`);
});
