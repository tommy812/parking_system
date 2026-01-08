import React from 'react'
import { useAuth } from '../context/AuthContext'
import { useState } from 'react' 

const ProfilePage = () => {
  const { user } = useAuth()
  return (
    <div>
      <h1>Profile</h1>
      <p>id: {user?.id}</p>
      <p>Name: {user?.username}</p>
      <p>Email: {user?.email}</p>
      <p>Role: {user?.role}</p>
      <p>Phone: {user?.phone}</p>
      <p>Created At: {user?.created_at}</p>
    </div>
  )
}

export default ProfilePage