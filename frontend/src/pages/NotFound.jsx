import React from 'react'
import { Link } from 'react-router-dom'

const NotFound = () => {
    return (
        <div className="flex justify-center items-center min-h-[50vh]">
        <div className="text-center">
            <p className="text-base font-semibold text-success">404</p>
            <h1 className="mt-4 text-5xl font-semibold tracking-tight text-balance text-prymary sm:text-7xl">Page not found</h1>
            <p className="mt-6 text-lg font-medium text-pretty text-gray-400 sm:text-xl/8">Sorry, we couldn’t find the page you’re looking for.</p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
                <Link to="/" className="btn btn-neutral mt-4">Go back home</Link>
            </div>
        </div>
        </div>
    )
}

export default NotFound