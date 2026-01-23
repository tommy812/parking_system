import React from 'react'

function formatOpenMinutes(minutesUtc, timezone = "Europe/London") {
  if (!Number.isFinite(minutesUtc)) return "—";
  if (minutesUtc === 1440) return "24:00";

  const date = new Date(Date.UTC(1970, 0, 1, 0, minutesUtc));
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function formatDateTime(value, timezone = "Europe/London") {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

const EntryCard = (props) => {
    const parking = props.parking;
  
    const { title, active, image, capacity, owner, footer, opening, closing, bookingStart, bookingEnd, onClick } = props;
    return (
        <div className="card bg-base-100  shadow-lg">
            <figure>
                <img
                    src={image}
                    alt={title} />
            </figure>

            
            <div className="card-body">
                <h2 className="card-title">
                    {title}
                </h2>
                {footer}
                <div className={`badge badge-sm badge-outline ${active ? "badge-success" : "badge-error"}`}>{active ? "Active" : "Inactive"}</div>

                <div className="text-sm space-y-1">
                    {capacity !== undefined && capacity !== null && (
                        <div>Spaces: {capacity}</div>
                    )}
                    {owner && <div>Owner: {owner}</div>}
                    {bookingStart || bookingEnd ? (
                        <div>
                            <div>Start: {formatDateTime(bookingStart)}</div>
                            <div>End: {formatDateTime(bookingEnd)}</div>
                        </div>
                    ) : (
                        <div>
                            <div>Opening: {formatOpenMinutes(opening)}</div>
                            <div>Closing: {formatOpenMinutes(closing)}</div>
                        </div>
                    )}
                </div>


                <div className="card-actions justify-end">
                    <button className="btn btn-primary btn-sm" onClick={onClick} disabled={!onClick}>View Details</button>
                </div>

                
            </div>
        </div>
    )
}

export default EntryCard