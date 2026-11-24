"use client"
import { useState, useEffect } from "react";

export default function LateEntry() {
    const [data, setData] = useState(null); 
    const [error, setError] = useState(null);
    const [bedtime, setBedTime] = useState({hour: "", minute: "", period: "pm"});
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
   
    if (data.dayStatus === "missing_bedtime") return (
        <div>
             <p>{data.day} bedtime is missing</p>

            <label htmlFor= "bedtime-hour">type in a hour</label>
            <input
                id="bedtime-hour"
                type = "number"
                value = {bedtime.hour}
                onChange={(e) => setBedTime({...bedtime, hour: e.target.value})}
            />

            <label htmlFor= "bedtime-minute">type in a minute</label>
            <input
                id="bedtime-minute"
                type = "number"
                value = {bedtime.minute}
                onChange={(e) => setBedTime({...bedtime, minute: e.target.value})}
            />

            <label htmlFor= "bedtime-period">Choose between the the two period</label>
            <select  id="bedtime-period" value={bedtime.period} onChange={(e) => setBedTime({...bedtime, period: e.target.value})}>
                <option value="pm">pm</option>
                <option value="am">am</option>
            </select>

            <p>{JSON.stringify(bedtime)}</p>
        </div>
    )

    if (data.dayStatus === "missing_waketime") return <p>{data.day} waketime is missing</p>;
    if (data.dayStatus === "complete") return <p>{data.day} is logged</p>;
   
    return <p>The yesterday date is: {data.day} and status: {data.dayStatus}</p>
    
}