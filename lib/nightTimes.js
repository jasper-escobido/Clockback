
const MAX_TIME_LIMIT = 12;

export function to24Hour (hour, period) {

    if (period === "pm" && hour === 12) {
     return 12;
    }

    if (period === "am" && hour === 12) {
        return 0;
    }

    if (period === "pm") {
       return hour + 12;
    }

    return hour;
}  

function firstMomentAfter (start, hour, minute, dateCounts) {
    const copy = new Date(start);
    let dateCheck;

    copy.setHours(hour, minute, 0,0);

    if (dateCounts) {
        dateCheck = copy < start;
    } else {
        dateCheck = copy <= start;
    }

    if (dateCheck) {
         copy.setDate(copy.getDate() + 1);
    }

    return copy;
}

const MS_PER_HOUR = 1 * 3600000;

function hoursBetween(bedtime, waketime) {
    const gap = waketime - bedtime;
    
    return gap / MS_PER_HOUR;

}

 export function describeYesterday(now) {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    const years = String(d.getFullYear());
    const months = String(d.getMonth() + 1).padStart(2, "0");
    const days = String(d.getDate()).padStart(2, "0");
    const nightDate = years + "-" + months + "-" + days;

    

    return nightDate;
}

export function resolveNight (windowStart, bedHour, bedMinute, wakeHour, wakeMinute) {
    const bedtime = firstMomentAfter(windowStart, bedHour, bedMinute, true);
    
    const wake = firstMomentAfter(bedtime, wakeHour, wakeMinute, false);
    
    const hours = hoursBetween(bedtime, wake);
  
    if (hours > MAX_TIME_LIMIT) {
       
        return {ok: false, reason: "too_long"};
    }
    return {ok: true, bedtime: bedtime, wake: wake, hours: hours};
}

export function resolveBedtime (windowStart, hour, minute) {
    return firstMomentAfter(windowStart, hour, minute, true);
}

export function isSleepTooLong (bedtime, waketime) {
    const hours = hoursBetween(bedtime, waketime);
    return hours > MAX_TIME_LIMIT;
}

export function resolveWake (bedtime, hour, minute) {
     return firstMomentAfter(bedtime, hour, minute, false);
}