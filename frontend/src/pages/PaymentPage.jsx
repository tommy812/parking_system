import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { createPaymentIntent, getStripeConfig, syncPaymentStatus } from "../api/paymentApi";
import { fetchBooking } from "../api/bookingApi";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

// Initialize Stripe (will be set after fetching config)
let stripePromise = null;

const PaymentForm = ({ bookingId, amount, currency, onSuccess, onError }) => {
  const stripe = useStripe();
  const elements = useElements();
  const { getAuthHeader } = useAuth();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setProcessing(true);
    setError("");

    try {
      const { error: submitError } = await elements.submit();
      if (submitError) {
        setError(submitError.message);
        setProcessing(false);
        return;
      }

      const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/payment-success?booking_id=${bookingId}`,
        },
        redirect: "if_required",
      });

      if (confirmError) {
        setError(confirmError.message);
        setProcessing(false);
      } else if (paymentIntent) {
        // Payment succeeded without redirect
        if (paymentIntent.status === "succeeded") {
          // Sync payment status to confirm booking
          const authHeader = getAuthHeader();
          try {
            const syncResult = await syncPaymentStatus({ booking_id: bookingId, authHeader });
            
            if (syncResult.synced_to === "CONFIRMED") {
              onSuccess();
            } else {
              // Wait a moment for webhook to process, then check again
              setTimeout(async () => {
                try {
                  const result = await syncPaymentStatus({ booking_id: bookingId, authHeader });
                  if (result.synced_to === "CONFIRMED") {
                    onSuccess();
                  } else {
                    // Still processing, redirect to success page which will poll
                    window.location.href = `/payment-success?booking_id=${bookingId}`;
                  }
                } catch (err) {
                  console.error(err);
                  // Redirect anyway, success page will handle it
                  window.location.href = `/payment-success?booking_id=${bookingId}`;
                }
              }, 1500);
            }
          } catch (syncErr) {
            console.error("Sync error:", syncErr);
            // Redirect to success page which will handle polling
            window.location.href = `/payment-success?booking_id=${bookingId}`;
          }
        } else {
          // Payment intent exists but not succeeded yet
          setError(`Payment status: ${paymentIntent.status}. Please wait...`);
          setProcessing(false);
        }
      } else {
        // No paymentIntent returned, might have redirected
        // This shouldn't happen with redirect: "if_required", but handle it
        setProcessing(false);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || "Payment failed");
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {error && (
        <div className="alert alert-error mt-4">
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
      <button
        type="submit"
        className="btn btn-primary w-full mt-6"
        disabled={!stripe || !elements || processing}
      >
        {processing ? (
          <>
            <span className="loading loading-spinner loading-sm"></span>
            Processing...
          </>
        ) : (
          `Pay £${((amount || 0) / 100).toFixed(2)}`
        )}
      </button>
    </form>
  );
};

const PaymentPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { getAuthHeader } = useAuth();
  const bookingId = searchParams.get("booking_id");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [publishableKey, setPublishableKey] = useState("");
  const [booking, setBooking] = useState(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  useEffect(() => {
    const initializePayment = async () => {
      if (!bookingId) {
        setError("Missing booking ID");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const authHeader = getAuthHeader();
        if (!authHeader.Authorization) {
          throw new Error("Not authenticated. Please log in.");
        }

        // Fetch booking details first
        const bookingData = await fetchBooking({ booking_id: bookingId, authHeader });
        setBooking(bookingData);

        // Check if booking is already confirmed
        if (bookingData.status === "CONFIRMED") {
          navigate(`/payment-success?booking_id=${bookingId}`);
          return;
        }

        // Get Stripe config
        const config = await getStripeConfig();
        setPublishableKey(config.publishableKey);
        
        // Initialize Stripe
        if (!stripePromise && config.publishableKey) {
          stripePromise = loadStripe(config.publishableKey);
        }

        // Create payment intent
        const intentData = await createPaymentIntent({ booking_id: bookingId, authHeader });
        setClientSecret(intentData.client_secret);
      } catch (err) {
        console.error(err);
        setError(err.message || "Failed to initialize payment");
      } finally {
        setLoading(false);
      }
    };

    initializePayment();
  }, [bookingId, getAuthHeader, navigate]);

  const handlePaymentSuccess = () => {
    setPaymentSuccess(true);
    setTimeout(() => {
      navigate(`/payment-success?booking_id=${bookingId}`);
    }, 2000);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="text-center">
            <span className="loading loading-spinner loading-lg"></span>
            <p className="mt-4 text-base-content/70">Loading payment...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && !clientSecret) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
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
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  if (paymentSuccess) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="alert alert-success">
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
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>Payment successful! Redirecting...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!stripePromise || !clientSecret) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="alert alert-error">
            <span>Failed to initialize payment. Please try again.</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Complete Your Payment</h1>

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

        <div className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body">
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-2">Booking Summary</h2>
              <p className="text-sm text-base-content/70">
                Booking ID: {bookingId}
              </p>
              {booking?.total_amount_pence !== undefined && booking?.total_amount_pence !== null && (
                <p className="text-lg font-bold mt-2">
                  Total: {booking.currency === "GBP" ? "£" : booking.currency || "£"}{" "}
                  {((booking.total_amount_pence || 0) / 100).toFixed(2)}
                </p>
              )}
              {booking?.start_at && booking?.end_at && (
                <div className="mt-4 text-sm text-base-content/70">
                  <p>
                    {new Date(booking.start_at).toLocaleString("en-GB", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                  <p className="mt-1">
                    to{" "}
                    {new Date(booking.end_at).toLocaleString("en-GB", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
              )}
            </div>

            <div className="divider"></div>

            <Elements
              stripe={stripePromise}
              options={{
                clientSecret,
                appearance: {
                  theme: "stripe",
                },
              }}
            >
              <PaymentForm
                bookingId={bookingId}
                amount={booking?.total_amount_pence}
                currency={booking?.currency}
                onSuccess={handlePaymentSuccess}
                onError={(err) => setError(err)}
              />
            </Elements>

            <div className="mt-6">
              <button
                className="btn btn-ghost w-full"
                onClick={() => navigate("/bookings")}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 alert alert-info">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            className="stroke-current shrink-0 w-6 h-6"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            ></path>
          </svg>
          <div>
            <div className="font-semibold">Test Mode</div>
            <div className="text-sm">
              Use test card: 4242 4242 4242 4242, any future expiry date, any CVC
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentPage;
