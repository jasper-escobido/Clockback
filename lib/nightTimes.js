
const MAX_TIME_LIMIT = 12;

function to24Hour (hour, period) {

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

function firstMomentAfter (start, hour, minute) {
    const copy = new Date(start);
    copy.setHours(hour, minute, 0,0);
    if (copy <= start) {
        copy.setDate(copy.getDate() + 1);
    }

    return copy;
}

const MS_PER_HOUR = 1 * 3600000;

function hoursBetween(bedtime, waketime) {
    const gap = waketime - bedtime;
    
    return gap / MS_PER_HOUR;

}

const a = new Date(2026, 10, 7, 22, 0);
const b = new Date(2026, 10, 8, 11, 0);
console.log(hoursBetween(a,b));

