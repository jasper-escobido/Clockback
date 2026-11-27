"use client"
import { useState, useEffect } from "react";

export default function LateEntry() {
    const [data, setData] = useState(null); 
    const [error, setError] = useState(null);
    const [bedtime, setBedTime] = useState({hour: "", minute: "", period: "pm"});
    const [waketime, setWakeTime] = useState({hour: "", minute: "", period: "am"});
    const [formError, setFormError] = useState(null);

    function loadStatus() {
          fetch("/api/late_entry")
        .then((res) => {
            if (!res.ok) throw new Error("Server said " + res.status);
            return res.json();
        })
        .then((result) => setData(result))
        .catch(() => setError("Couldn't load your data"));
    }

    useEffect(() => {
        loadStatus();
        }, []); 

        function handleSubmit(body) {
            setFormError(null);
            fetch("/api/late_entry", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify(body),
            })
            .then((res) => {
                return res.json().then((json) => {
                    if (!res.ok) {
                        setFormError(json.error);
                    } else {
                        loadStatus();
                    }
                });
            })
            .catch(() => setFormError("Couldn't reach the server"));
        }

    if (error !== null) return <p>{error}</p>;
    if (data === null) return <p>Loading...</p>;
   
    if (data.dayStatus === "missing_Bedtime" || data.dayStatus === "log_not_found") return (
        <div>
             <p>{data.day} bedtime is missing</p>
                <TimeInput value={bedtime} onChange={setBedTime} idPrefix="bedtime"/>
      
            <p>{JSON.stringify(bedtime)}</p>
            <button type = "button" onClick ={() => handleSubmit({bedtime: {hour: Number(bedtime.hour), minute: Number(bedtime.minute), period: bedtime.period}})}>Save</button>
            {formError !== null && <p>{formError}</p>}
        </div>
    )
   
    if (data.dayStatus === "missing_waketime") return (
    <div>
        <p>{data.day} waketime is missing</p>
              <TimeInput value={waketime} onChange={setWakeTime} idPrefix="waketime"/>
      
            <p>{JSON.stringify(waketime)}</p>
            <button type = "button" onClick ={() => handleSubmit({wake_time: {hour: Number(waketime.hour), minute: Number(waketime.minute), period: waketime.period}})}>Save</button>
            {formError !== null && <p>{formError}</p>}
    </div>
    )
    if (data.dayStatus === "complete") return <p>{data.day} is logged</p>;
   
    return <p>The yesterday date is: {data.day} and status: {data.dayStatus}</p>
    
}

function TimeInput(props) {
    return (
        <div>
                <label htmlFor= {props.idPrefix + "-hour"}>type in a hour</label>
            <input
                id={props.idPrefix + "-hour"}
                type = "number"
                value = {props.value.hour}
                onChange={(e) => props.onChange({...props.value, hour: e.target.value})}
            />

            <label htmlFor= {props.idPrefix + "-minute"}>type in a minute</label>
            <input
                id={props.idPrefix + "-minute"}
                type = "number"
                value = {props.value.minute}
                onChange={(e) => props.onChange({...props.value, minute: e.target.value})}
            />

            <label htmlFor= {props.idPrefix + "-period"}>Choose between the the two period</label>
            <select  id={props.idPrefix + "-period"} value={props.value.period} onChange={(e) => props.onChange({...props.value, period: e.target.value})}>
                <option value="pm">pm</option>
                <option value="am">am</option>
            </select>
        </div>
    )
}