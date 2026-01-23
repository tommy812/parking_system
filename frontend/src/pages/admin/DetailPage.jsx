import React from 'react'

const DetailPage = (props) => {
    const { title } = props.params;
    const { description } = props.params;
    const { image } = props.params;
    const { capacity } = props.params;
    const { owner } = props.params;
    const { opening } = props.params;
    const { closing } = props.params;
    const { active } = props.params;
    const { status } = props.params;
    const { created_at } = props.params;
    const { updated_at } = props.params;
    const { deleted_at } = props.params;
    const { is_active } = props.params;
    const { is_approved } = props.params;
    const { is_deleted } = props.params;
    const { is_archived } = props.params;
    const { is_featured } = props.params;
  return (
    <div>
        <h1>Detail Page</h1>
        <p>Title: {title}</p>
        <p>Description: {description}</p>
        <p>Image: {image}</p>
        <p>Capacity: {capacity}</p>
        <p>Owner: {owner}</p>
        <p>Opening: {opening}</p>
        <p>Closing: {closing}</p>
        <p>Active: {active}</p>
        <p>Status: {status}</p>
    </div>
  )
}

export default DetailPage