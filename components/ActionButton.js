"use client"
import { useState } from "react"

export default function ActionButton(props) {
    const [hasTapped, setHasTapped] = useState(false);
    const handleTap = () => {
        setHasTapped(true);
        console.log(props.action);
        fetch("/api/sleep", {
            method: "POST",
            headers: {"Content-type": "application/json"},
            body: JSON.stringify({action: props.action}),
        });
    }

    return (
        <button type="button" className="p-6 cursor-pointer bg-blue-500" onClick={handleTap} disabled={hasTapped}>{props.label}</button>
    )
}