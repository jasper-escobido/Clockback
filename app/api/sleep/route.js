import pool from "../../../lib/db";


export async function POST(request) {
    const body = await request.json();
    console.log(body);

    if (body.action !== "sleep" && body.action !== "wake") {
    return Response.json({ error: "bad action" }, { status: 400 });
}
    const date = new Date();
    if (date.getHours() < 12) {
        date.setDate(date.getDate() - 1);
    }
    const years = String(date.getFullYear());
    const months = String(date.getMonth() + 1).padStart(2, "0");
    const days = String(date.getDate()).padStart(2, "0");
    const nightDate = years + "-" + months + "-" + days;
    console.log(nightDate);

    if (body.action === "sleep") {
        const tapTime = new Date();
       await pool.query(
        "INSERT INTO sleep_logs (user_id, night_date, bedtime, bedtime_source) VALUES ($1, $2, $3, $4)",
        [1, nightDate, tapTime, "tapped"]
        );
    }

    return Response.json("Connected"); 
    
}

export async function GET() {
    const result = await pool.query("SELECT username FROM users WHERE id = $1", [1]);

    return Response.json(result.rows); 
    
}