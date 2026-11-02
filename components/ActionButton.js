"use client"
import { useState } from "react"

export default function ActionButton(props) {
    const [hasTapped, setHasTapped] = useState(false);

    return (
        <button type="button" className="p-6 cursor-pointer bg-blue-500" onClick={() => {setHasTapped(true);console.log(props.action);fetch("/api/sleep", {method: "POST"});}} disabled={hasTapped}>{props.label}</button>
    )
}