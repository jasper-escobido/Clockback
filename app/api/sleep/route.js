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
        const tapNightTime = new Date();
        try {
            await pool.query(
            "INSERT INTO sleep_logs (user_id, night_date, bedtime, bedtime_source) VALUES ($1, $2, $3, $4)",
            [1, nightDate, tapNightTime, "tapped"]
            );

        } catch (error) {
            if (error.constraint === "sleep_logs_user_id_night_date_key"){
                 return Response.json({ error: "sleep already logged today" }, { status: 409 });
            }
            throw error;
        }
    }

    if (body.action === "wake") {
        const tapWakeTime = new Date();
        const result = await pool.query (
            "UPDATE sleep_logs SET wake_time = $1, wake_time_source =  $2 WHERE user_id = $3 AND night_date = $4 AND wake_time IS NULL;", 
            [tapWakeTime, "tapped", 1, nightDate]
        );

        if (result.rowCount === 0) {
            try {
                await pool.query(
                     "INSERT INTO sleep_logs (user_id, night_date, wake_time, wake_time_source) VALUES ($1, $2, $3, $4)",
                    [1, nightDate, tapWakeTime, "tapped"]
                );

            } catch (error) {
                 if (error.constraint === "sleep_logs_user_id_night_date_key"){
                 return Response.json({ error: "wake already logged today" }, { status: 409 });
                }
                throw error;
            }
        }
    }

    return Response.json("Connected"); 
    
}

export async function GET() {
    const result = await pool.query("SELECT username FROM users WHERE id = $1", [1]);

    return Response.json(result.rows); 
    
}