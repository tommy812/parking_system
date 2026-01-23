import React from "react";

const ParkingCard = ({ 
  parking, 
  isSelected = false, 
  distanceMiles, 
  onSelect 
}) => {
  const formatPrice = () => {
    if (parking.price_pence !== undefined && parking.price_pence !== null) {
      return `£${((parking.price_pence || 0) / 100).toFixed(2)}`;
    }
    if (parking.price) {
      return `£${parking.price}`;
    }
    if (parking.total_amount_pence) {
      return `£${((parking.total_amount_pence || 0) / 100).toFixed(2)}`;
    }
    return "£—";
  };

  const formatDistance = () => {
    if (!Number.isFinite(distanceMiles?.(parking))) return null;
    const miles = distanceMiles(parking);
    if (miles < 1) {
      return `${(miles * 1760).toFixed(0)} yards away`;
    }
    if (miles < 10) {
      return `${miles.toFixed(1)} miles away`;
    }
    return `${Math.round(miles)} miles away`;
  };

  return (
    <div
      className={`card bg-base-100 border border-base-300 shadow-sm cursor-pointer hover:shadow-md transition-shadow ${
        isSelected ? "ring-2 ring-primary" : ""
      }`}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.(parking);
      }}
    >
      <div className="card-body p-4">
        <div className="flex gap-3">
          <div className="w-16 h-16 bg-base-300 rounded-lg shrink-0 overflow-hidden">
            {parking.imageUrl ? (
              <img 
                src={parking.imageUrl} 
                alt={parking.name} 
                className="w-full h-full object-cover" 
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-base-content/30">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M5 13l4 4L19 7" 
                  />
                </svg>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm truncate">{parking.name}</h3>
            <p className="text-xs text-base-content/70 mt-1 line-clamp-2">
              {parking.address || "Address not provided"}
            </p>
            {formatDistance() && (
              <p className="text-xs text-base-content/70 mt-1">
                {formatDistance()}
              </p>
            )}
            {parking.available !== undefined && (
              <div className="mt-1">
                {parking.available ? (
                  <span className="badge badge-success badge-sm">Available</span>
                ) : (
                  <span className="badge badge-error badge-sm">Sold Out</span>
                )}
                {parking.capacity && parking.booked_count !== undefined && (
                  <span className="text-xs text-base-content/70 ml-2">
                    {parking.capacity - parking.booked_count} of {parking.capacity} spaces
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="card-actions justify-end mt-1">
          <button 
            className={`btn btn-primary btn-sm ${parking.available === false ? "btn-disabled" : ""}`}
            disabled={parking.available === false}
          >
            Reserve for {formatPrice()}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ParkingCard;
