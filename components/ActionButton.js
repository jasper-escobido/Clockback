"use client"

export default function ActionButton(props) {

    return (
        <button type="button" className="p-6 cursor-pointer bg-blue-500" onClick={() => console.log("tapped")}>{props.label}</button>
    )
}