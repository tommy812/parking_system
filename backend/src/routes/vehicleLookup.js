const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/auth");

/**
 * Vehicle lookup API endpoint
 * This is a placeholder that simulates vehicle data lookup from registration
 * In production, you would integrate with DVLA VES API or similar service
 */
router.post("/lookup", requireAuth, async (req, res, next) => {
  try {
    const { registration } = req.body;

    if (!registration) {
      return res.status(400).json({ error: "Registration number is required" });
    }

    // Normalize registration (remove spaces, convert to uppercase)
    const normalizedReg = String(registration).replace(/\s+/g, "").toUpperCase();

    // Placeholder: In production, call DVLA VES API or similar service
    // For now, return mock data based on common UK registration patterns
    // You can replace this with actual API call:
    // const response = await fetch('https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles', {
    //   method: 'POST',
    //   headers: {
    //     'x-api-key': process.env.DVLA_API_KEY,
    //     'Content-Type': 'application/json'
    //   },
    //   body: JSON.stringify({ registrationNumber: normalizedReg })
    // });

    // Mock response for demonstration
    // Extract year from registration if possible (UK format: first 2 digits after letters)
    const yearMatch = normalizedReg.match(/\d{2}/);
    const estimatedYear = yearMatch ? 2000 + parseInt(yearMatch[0]) : null;
    if (estimatedYear && estimatedYear > new Date().getFullYear()) {
      estimatedYear -= 100; // Handle years like 20XX vs 19XX
    }

    // Mock vehicle data
    const mockVehicles = {
      "WN15HDV": { make: "Ford", model: "Fiesta Titanium X", color: "Blue", year: 2015 },
      "AB12CDE": { make: "Toyota", model: "Corolla", color: "Silver", year: 2012 },
      "XY99ZYX": { make: "BMW", model: "3 Series", color: "Black", year: 1999 },
    };

    const vehicleData = mockVehicles[normalizedReg] || {
      make: "Unknown",
      model: "Unknown",
      color: "Unknown",
      year: estimatedYear || new Date().getFullYear() - 5,
    };

    res.json({
      registration: normalizedReg,
      make: vehicleData.make,
      model: vehicleData.model,
      color: vehicleData.color,
      year: vehicleData.year,
      // Note: This is mock data. Replace with actual API integration
      _mock: true,
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
