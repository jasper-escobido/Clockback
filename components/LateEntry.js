"use client"
import { useState, useEffect } from "react";

export default function LateEntry() {
    const [data, setData] = useState(null); 
    const [error, setError] = useState(null);

    useEffect(() => {
        fetch("/api/late_entry")
        .then((res) => {
            if (!res.ok) throw new Error("Server said " + res.status);
            return res.json();
        })
        .then((result) => setData(result))
        .catch(() => setError("Couldn't load your data"));
        }, []); 


    if (error !== null) return <p>{error}</p>;
    if (data === null) return <p>Loading...</p>;
    if (data.dayStatus === "log_not_found") return <p>{data.day} logs is not found</p>;
    if (data.dayStatus === "missing_bedtime") return <p>{data.day} bedtime is missing</p>;
    if (data.dayStatus === "missing_waketime") return <p>{data.day} waketime is missing</p>;
    if (data.dayStatus === "complete") return <p>{data.day} is logged</p>;
   
    return <p>The yesterday date is: {data.day} and status: {data.dayStatus}</p>
    
}