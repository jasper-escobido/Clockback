import { describeYesterday } from "../../../lib/nightTimes";
import pool from "../../../lib/db";

export async function GET() {
    const yesterday = describeYesterday(new Date());
    let status;

    const dayFound = await pool.query (
        "SELECT id, bedtime, wake_time FROM sleep_logs where user_id = $1 AND night_date = $2", 
        [1, yesterday]
    );

    if (dayFound.rows.length === 0) {
        status = "log_not_found";
    } else if (dayFound.rows[0].bedtime === null) {
        status = "missing_bedtime";
    } else if (dayFound.rows[0].wake_time === null) {
        status = "missing_waketime";
    } else {
        status = "complete";
    }

    return Response.json({day: yesterday, dayStatus: status});
}