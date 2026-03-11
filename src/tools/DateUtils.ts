import moment from "moment";
import { DateOptionType } from "../types/DateTypes";


const epochYearStart: number = moment().startOf('year').valueOf();

export function epochTo(millis: number, type?: DateOptionType, lang: string = "es") {
    if (!type || type == "v1") {
        // Format: "17 de enero de 2026"
        if (millis > epochYearStart) {
            return moment(millis).locale(lang).format('D [de] MMMM');
        } else {
            return moment(millis).locale(lang).format('LL');
        }
    } else if (type == "v2") {
        // Custom Format: "17/01/2026"
        return moment(millis).locale(lang).format('DD/MM/YYYY');
    } else if (type == "v3") {
        // Full string: "sábado, 17 de enero de 2026"
        return moment(millis).locale(lang).format('dddd, D [de] MMMM [de] YYYY');
    } else if (type == "v4") {
        // Format: "17 de enero de 2026"
        if (millis > epochYearStart) {
            return moment(millis).locale(lang).format('D [de] MMMM - h:mm a');
        } else {
            return moment(millis).locale(lang).format('YYYY D [de] MMMM - h:mm a');
        }
    } else if (type == "v5") {
        // Format: "sabado, 17 de enero de 2026"
        if (millis > epochYearStart) {
            return moment(millis).locale(lang).format('dddd, D [de] MMMM - h:mm a');
        } else {
            return moment(millis).locale(lang).format('dddd, YYYY, D [de] MMMM - h:mm a');
        }
    } else {
        throw new Error(`Type ${type} not exist`);
    }
}