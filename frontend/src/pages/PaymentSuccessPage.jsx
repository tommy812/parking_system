import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { syncPaymentStatus } from "../api/paymentApi";
import { fetchBooking } from "../api/bookingApi";

const PaymentSuccessPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { getAuthHeader } = useAuth();
  const bookingId = searchParams.get("booking_id");

  const [loading, setLoading] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!bookingId) {
      setLoading(false);
      setError("Missing booking ID");
      return;
    }

    const checkPaymentStatus = async () => {
      try {
        const authHeader = getAuthHeader();
        if (!authHeader.Authorization) {
          setError("Not authenticated");
          setLoading(false);
          return;
        }

        // First, try to sync payment status (this will update booking if payment succeeded)
        try {
          await syncPaymentStatus({ booking_id: bookingId, authHeader });
        } catch (syncErr) {
          console.warn("Sync payment status error:", syncErr);
          // Continue anyway, we'll check booking status
        }

        // Then fetch the booking to check its current status
        const bookingData = await fetchBooking({ booking_id: bookingId, authHeader });
        setBooking(bookingData);

        if (bookingData.status === "CONFIRMED") {
          setConfirmed(true);
          setLoading(false);
          return;
        }

        // If still pending, poll a few more times
        let attempts = 0;
        const maxAttempts = 5;
        const pollInterval = setInterval(async () => {
          attempts++;
          try {
            await syncPaymentStatus({ booking_id: bookingId, authHeader });
            const updatedBooking = await fetchBooking({ booking_id: bookingId, authHeader });
            setBooking(updatedBooking);

            if (updatedBooking.status === "CONFIRMED") {
              setConfirmed(true);
              setLoading(false);
              clearInterval(pollInterval);
            } else if (attempts >= maxAttempts) {
              setLoading(false);
              clearInterval(pollInterval);
              setError("Payment is still processing. Please check back in a few moments.");
            }
          } catch (err) {
            console.error("Polling error:", err);
            if (attempts >= maxAttempts) {
              setLoading(false);
              clearInterval(pollInterval);
            }
          }
        }, 2000);

        // Initial check
        setLoading(false);

        return () => clearInterval(pollInterval);
      } catch (err) {
        console.error(err);
        setError(err.message || "Failed to check payment status");
        setLoading(false);
      }
    };

    checkPaymentStatus();
  }, [bookingId, getAuthHeader]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto text-center">
          <span className="loading loading-spinner loading-lg"></span>
          <p className="mt-4 text-base-content/70">Confirming payment...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        {error && (
          <div className="alert alert-warning mb-6">
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
            <span>{error}</span>
          </div>
        )}

        <div className="card bg-base-100 border border-base-300 shadow-lg">
          <div className="card-body text-center">
            {confirmed || booking?.status === "CONFIRMED" ? (
              <>
                <div className="mb-4">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-20 w-20 text-success mx-auto"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <h1 className="text-3xl font-bold mb-4">Payment Successful!</h1>
                <p className="text-base-content/70 mb-6">
                  Your booking has been confirmed. You will receive a confirmation email shortly.
                </p>
                {bookingId && (
                  <p className="text-sm text-base-content/60 mb-6">
                    Booking ID: {bookingId}
                  </p>
                )}
                <div className="flex gap-4 justify-center">
                  <Link to="/bookings" className="btn btn-primary">
                    View My Bookings
                  </Link>
                  <Link to="/" className="btn btn-outline">
                    Back to Home
                  </Link>
                </div>
              </>
            ) : (
              <>
                <div className="mb-4">
                  <span className="loading loading-spinner loading-lg"></span>
                </div>
                <h1 className="text-2xl font-bold mb-4">Processing Payment...</h1>
                <p className="text-base-content/70 mb-6">
                  Your payment is being processed. This may take a few moments.
                  {booking?.status && (
                    <span className="block mt-2 text-sm">
                      Current status: <strong>{booking.status}</strong>
                    </span>
                  )}
                </p>
                <div className="flex gap-4 justify-center">
                  <button
                    className="btn btn-primary"
                    onClick={async () => {
                      try {
                        const authHeader = getAuthHeader();
                        await syncPaymentStatus({ booking_id: bookingId, authHeader });
                        const updatedBooking = await fetchBooking({ booking_id: bookingId, authHeader });
                        setBooking(updatedBooking);
                        if (updatedBooking.status === "CONFIRMED") {
                          setConfirmed(true);
                        }
                      } catch (err) {
                        console.error(err);
                        setError(err.message || "Failed to check status");
                      }
                    }}
                  >
                    Check Status
                  </button>
                  <Link to="/bookings" className="btn btn-outline">
                    View Bookings
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccessPage;
