import React from 'react'

 function formatOpenMinutes(minutesUtc, timezone = "Europe/London") {
    if (minutesUtc === 1440) return "24:00";
  
    const date = new Date(Date.UTC(1970, 0, 1, 0, minutesUtc));
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  }

const EntryCard = (props) => {
    const parking = props.parking;
  
    const { title, active, image, capacity, owner, footer, opening, closing} = props;
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

                <p>Spaces:{capacity} 
                    <br/> Owner:{owner} <br/>
                    Opening: {formatOpenMinutes(opening)} <br/>
                    Closing: {formatOpenMinutes(closing)} </p>


                <div className="card-actions justify-end">
                    <button className="btn btn-primary btn-sm">View Details</button>
                </div>

                
            </div>
        </div>
    )
}

export default EntryCard