import { describeYesterday } from "../../../lib/nightTimes";
import pool from "../../../lib/db";

export async function GET() {
    const yesterday = describeYesterday(new Date());

    const dayFound = await pool.query (
        "SELECT id, bedtime, wake_time FROM sleep_logs where user_id = $1 AND night_date = $2", 
        [1, yesterday]
    );

    return Response.json({day: yesterday, rows: dayFound.rows});
}