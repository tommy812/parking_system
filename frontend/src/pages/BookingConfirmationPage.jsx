import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getBookingQuote, createBooking } from "../api/bookingApi";
import { fetchParkings } from "../api/parkingApi";
import ParkingCard from "../components/ParkingCard";
import TextField from "../components/forms/TextField";

const BookingConfirmationPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, getAuthHeader } = useAuth();

  const parkingId = searchParams.get("parking_id");
  const startAt = searchParams.get("start_at");
  const endAt = searchParams.get("end_at");

  const [parking, setParking] = useState(null);
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!parkingId || !startAt || !endAt) {
      setError("Missing required booking information");
      setLoading(false);
      return;
    }

    if (!user) {
      navigate("/login");
      return;
    }

    const loadData = async () => {
      try {
        setLoading(true);
        const authHeader = getAuthHeader();

        // Fetch parking details
        const { parkings } = await fetchParkings({});
        const foundParking = parkings.find((p) => p.id === parkingId);
        if (!foundParking) {
          setError("Parking not found");
          setLoading(false);
          return;
        }
        setParking(foundParking);

        // Get quote
        const quoteData = await getBookingQuote({
          parking_id: parkingId,
          start_at: startAt,
          end_at: endAt,
          authHeader,
        });
        setQuote(quoteData);
      } catch (err) {
        console.error(err);
        setError(err.message || "Failed to load booking information");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [parkingId, startAt, endAt, user, navigate, getAuthHeader]);

  const formatDateTime = (isoString) => {
    if (!isoString) return "";
    const date = new Date(isoString);
    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  };

  const formatDuration = (minutes) => {
    if (!minutes) return "";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins} minutes`;
    if (mins === 0) return `${hours} ${hours === 1 ? "hour" : "hours"}`;
    return `${hours} ${hours === 1 ? "hour" : "hours"} ${mins} minutes`;
  };

  const handleContinueToPayment = async () => {
    if (!parkingId || !startAt || !endAt) return;

    try {
      setSubmitting(true);
      setError("");

      const authHeader = getAuthHeader();
      const bookingResponse = await createBooking({
        parking_id: parkingId,
        start_at: startAt,
        end_at: endAt,
        authHeader,
      });

      // Extract booking ID from response
      // Backend returns { booking: {...}, ... }
      const bookingId = bookingResponse.booking?.id;
      if (!bookingId) {
        throw new Error("Failed to get booking ID from response");
      }

      // Navigate to payment page with booking ID
      navigate(`/payment?booking_id=${bookingId}`);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to create booking");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center">
            <span className="loading loading-spinner loading-lg"></span>
            <p className="mt-4 text-base-content/70">Loading booking details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && !parking) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="alert alert-error">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="stroke-current shrink-0 h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>{error}</span>
          </div>
          <button className="btn btn-primary mt-4" onClick={() => navigate("/")}>
            Back to Search
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Confirm Your Booking</h1>

        {error && (
          <div className="alert alert-error mb-6">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="stroke-current shrink-0 h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Parking Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Parking Details */}
            <div className="card bg-base-100 border border-base-300 shadow-sm">
              <div className="card-body">
                <h2 className="card-title text-xl mb-4">Parking Details</h2>
                {parking && (
                  <ParkingCard
                    parking={parking}
                    isSelected={false}
                    distanceMiles={() => null}
                    onSelect={() => {}}
                  />
                )}
              </div>
            </div>

            {/* Booking Timings */}
            <div className="card bg-base-100 border border-base-300 shadow-sm">
              <div className="card-body">
                <h2 className="card-title text-xl mb-4">Booking Period</h2>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-semibold text-base-content/70">From</label>
                    <p className="text-lg">{formatDateTime(startAt)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-base-content/70">Until</label>
                    <p className="text-lg">{formatDateTime(endAt)}</p>
                  </div>
                  {quote && (
                    <div>
                      <label className="text-sm font-semibold text-base-content/70">Duration</label>
                      <p className="text-lg">{formatDuration(quote.duration_minutes)}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Vehicle Details */}
            <div className="card bg-base-100 border border-base-300 shadow-sm">
              <div className="card-body">
                <h2 className="card-title text-xl mb-4">Vehicle Details</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-base-content/70">Registration</label>
                    <p className="text-lg">
                      {user?.vehicle_reg || <span className="text-base-content/50">Not provided</span>}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-base-content/70">Model</label>
                    <p className="text-lg">
                      {user?.vehicle_model || <span className="text-base-content/50">Not provided</span>}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-base-content/70">Color</label>
                    <p className="text-lg">
                      {user?.vehicle_color || <span className="text-base-content/50">Not provided</span>}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-base-content/70">Year</label>
                    <p className="text-lg">
                      {user?.vehicle_year || <span className="text-base-content/50">Not provided</span>}
                    </p>
                  </div>
                </div>
                {(!user?.vehicle_reg || !user?.vehicle_model) && (
                  <div className="alert alert-warning mt-4">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="stroke-current shrink-0 h-6 w-6"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                    <span>
                      Please update your vehicle details in your{" "}
                      <a href="/profile" className="link">
                        profile
                      </a>{" "}
                      before booking.
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Price Summary */}
          <div className="lg:col-span-1">
            <div className="card bg-base-100 border border-base-300 shadow-sm sticky top-4">
              <div className="card-body">
                <h2 className="card-title text-xl mb-4">Price Summary</h2>
                {quote ? (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-base-content/70">Total Price</span>
                      <span className="text-2xl font-bold">
                        {quote.currency === "GBP" ? "£" : quote.currency}{" "}
                        {((quote.price_pence || 0) / 100).toFixed(2)}
                      </span>
                    </div>
                    {quote.duration_minutes && (
                      <div className="text-sm text-base-content/70">
                        For {formatDuration(quote.duration_minutes)}
                      </div>
                    )}
                    <div className="divider"></div>
                    <button
                      className="btn btn-primary w-full"
                      onClick={handleContinueToPayment}
                      disabled={submitting || !user?.vehicle_reg || !user?.vehicle_model}
                    >
                      {submitting ? (
                        <>
                          <span className="loading loading-spinner loading-sm"></span>
                          Processing...
                        </>
                      ) : (
                        "Continue to Payment"
                      )}
                    </button>
                    <button
                      className="btn btn-ghost w-full"
                      onClick={() => navigate("/")}
                      disabled={submitting}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="text-center text-base-content/70">Loading price...</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookingConfirmationPage;
