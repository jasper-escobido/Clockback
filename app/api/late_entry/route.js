import { describeYesterday, to24Hour, resolveNight, resolveBedtime } from "../../../lib/nightTimes";
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

     const now = new Date();
     const windowStart = new Date(now);
     windowStart.setDate(windowStart.getDate() - 1);
     windowStart.setHours(12, 0, 0, 0);
     const nightDate = describeYesterday(now);


     if (body.bedtime !== undefined && body.wake_time !== undefined) {
        const bedTimeHour = to24Hour(body.bedtime.hour, body.bedtime.period);
        const wakeTimeHour = to24Hour(body.wake_time.hour, body.wake_time.period);
        const result = resolveNight(windowStart, bedTimeHour, body.bedtime.minute, wakeTimeHour, body.wake_time.minute);

        if (result.ok === false) {
            return Response.json({error: "the hours are longer than the limit"}, {status: 400});
        }

        if (result.wake > now) {
            return Response.json({error: "waketime is in the future"}, {status: 400});
        }

        const dataFound = await pool.query (
            "SELECT id, bedtime, wake_time FROM sleep_logs where user_id = $1 AND night_date = $2", 
            [1, nightDate]
        );

        if (dataFound.rows.length === 0) {
            await pool.query (
                "INSERT INTO sleep_logs (user_id, night_date, bedtime, wake_time, bedtime_source, wake_time_source) VALUES ($1, $2, $3, $4, 'entered later', 'entered later')",
                [1, nightDate, result.bedtime, result.wake]
            );
        } else {
            await pool.query (
                "UPDATE sleep_logs SET bedtime = $1, wake_time = $2, bedtime_source = 'entered later', wake_time_source = 'entered later' WHERE id = $3",
                [result.bedtime, result.wake, dataFound.rows[0].id]
            );
        }

     } else if (body.bedtime !== undefined) {
        const bedTimeHour = to24Hour(body.bedtime.hour, body.bedtime.period);
        const bedTimeMoment = resolveBedtime(windowStart, bedTimeHour, body.bedtime.minute);

        if (bedTimeMoment > now) {
            return Response.json({error: "bedtime is in the future"}, {status: 400});
        }

          const dataFound = await pool.query (
            "SELECT id, bedtime, wake_time FROM sleep_logs where user_id = $1 AND night_date = $2", 
            [1, nightDate]
        );


        if (dataFound.rows.length === 0) {
            await pool.query(
                "INSERT INTO sleep_logs (user_id, night_date, bedtime, bedtime_source) VALUES ($1, $2, $3, 'entered later')",
                [1, nightDate, bedTimeMoment]
            );
        }

     }

     return Response.json("ok");
}