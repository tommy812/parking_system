import React from 'react'

const EntryCard = (props) => {
    const { title, active, image, capacity, owner} = props;
    return (
        <div className="card bg-base-100  shadow-lg">
            <figure>
                <img
                    src={image}
                    alt={title} />
            </figure>
            <div className="card-body">
                <h2 className="card-title">{title}

                </h2>
                <div className={`badge badge-sm badge-outline ${active ? "badge-success" : "badge-error"}`}>{active ? "Active" : "Inactive"}</div>

                <p>Spaces:{capacity}</p>
                <p>Owner:{owner}</p>
                
                <div className="card-actions justify-end">
                    <button className="btn btn-primary btn-sm">View Details</button>
                </div>
            </div>
        </div>
    )
}

export default EntryCard