
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

console.log(to24Hour(5, "am"));
console.log(to24Hour(12, "am"));
console.log(to24Hour(12, "pm"));
console.log(to24Hour(5, "pm"));