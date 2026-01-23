import React from "react";

const ParkingCardSkeleton = () => {
  return (
    <div className="card bg-base-100 border border-base-300 shadow-sm">
      <div className="card-body p-4">
        <div className="flex gap-3">
          <div className="w-16 h-16 bg-base-300 rounded-lg shrink-0 overflow-hidden">
            <div className="skeleton h-full w-full"></div>
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <div className="skeleton h-4 w-3/4"></div>
            <div className="skeleton h-3 w-full"></div>
            <div className="skeleton h-3 w-2/3"></div>
            <div className="skeleton h-5 w-24"></div>
          </div>
        </div>
        <div className="card-actions justify-end mt-1">
          <div className="skeleton h-8 w-32"></div>
        </div>
      </div>
    </div>
  );
};

export default ParkingCardSkeleton;
