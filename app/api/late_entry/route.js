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

function validateTime (time, label) {
        
            if (time.hour === undefined || time.minute === undefined || time.period === undefined) {
                return label + " needs hour, minute, and period";
            }

            if (!Number.isInteger(time.hour) || time.hour < 1 || time.hour > 12) {
                return label + " hours must be a whole number from 1 to 12";
            }

            if (!Number.isInteger(time.minute) || time.minute < 0 || time.minute > 59) {
                return label + " minutes must be a whole number from 0 to 59";
            }

            if (time.period !== "am" && time.period !== "pm") {
                return  label + " period must be am or pm";
            }

            return null;
}

export async function POST(request) {
     const body = await request.json();

     if (body.bedtime === undefined && body.wake_time === undefined) {
        return Response.json({error: "both bedtime and waketime are missing"}, {status: 400});
     }

     if (body.bedtime !== undefined) {
        const problem = validateTime(body.bedtime, "bedtime");
        if (problem !== null) {
            return Response.json({error: problem}, {status: 400});
        }

     }

     if (body.wake_time !== undefined) {
       const problem = validateTime(body.wake_time, "wake_time");
       if (problem !== null) {
        return Response.json({error: problem}, {status: 400});
       }
     }

     return Response.json("ok");
}