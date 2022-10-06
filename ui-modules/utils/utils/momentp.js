/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

/* momentp is like moment.js, but returns more precise humanized output, e.g. '1m 20s ago` or `1y 220d` */

import {capitalize, rounded} from "./general";

export class MomentPrecise {
    // means all time-ago round to 5s which is a nicer UX than constantly updating (even if occasionally misleading)
    precisionForFromNow = 5000;
    summaryForBelowPrecisionThreshhold = "a few seconds";
    capitalized = false;

    constructor() {
    }

    setPrecisionForFromNow(precisionMillis, summaryForBelowPrecisionThreshhold) {
        this.precisionForFromNow = precisionMillis;
        this.summaryForBelowPrecisionThreshhold = summaryForBelowPrecisionThreshhold;
        return this;
    }

    setCapitalized(capitalized) {
        this.capitalized = capitalized;
        return this;
    }

    capitalize(s) {
        if (this.capitalized) return capitalize(s);
        return s;
    }

    fromNow(utc) {
        if (!utc) return this.capitalize("-");
        var millis = utc - Date.now();
        if (millis==0) return this.capitalize("now");
        const ago = millis < 0;
        if (ago) millis = -millis;

        var s;
        if (millis*4 < 3*this.precisionForFromNow) s = this.summaryForBelowPrecisionThreshhold;
        else if (this.precisionForFromNow>0) s = this.duration( Math.round(millis/this.precisionForFromNow)*this.precisionForFromNow );
        else s = this.duration(millis);

        if (ago) s = s +" ago";
        else s = "in " + s;
        return this.capitalize(s);
    }

    duration(millis) {
        if (millis === 0) return this.capitalize("0ms");
        if (!millis) return this.capitalize("-");
        let tweak = x=>this.capitalize(x);
        if (millis < 0) {
            millis = -millis;
            tweak = x=> {
                return "- " + this.capitalize(x);
            }
        }

        if (millis < 1000) return tweak(millis+"ms");

        let secs = millis/1000;
        let secsR = Math.round(secs);
        if (secs < 10) return tweak(rounded(secs, 1)+"s");
        if (secs < 60) return tweak(secsR+"s");

        let mins = Math.floor(secs/60);
        let minsR = Math.round(secs/60);
        secs = Math.round(secs - mins*60);
        if (secs>=60) {
            mins++;
            secs -= 60;
        }
        if (mins < 5) {
            return tweak(mins +"m" + " " + secs +"s");
        }
        if (mins < 60) {
            return tweak(minsR) +" mins";
        }

        let hours = Math.floor(mins/60);
        let hoursR = Math.round(mins/60);
        mins = Math.round(mins - hours*60);
        if (mins >= 60) {
            hours++;
            mins -= 60;
        }
        if (hours < 4) return tweak(hours +"h" +" " + mins +"m");
        if (hours < 24) return tweak(hoursR) +" hours";

        let days = Math.floor(hours/24);
        let daysR = Math.round(hours/24);
        hours = Math.round(hours - days*24);
        if (hours >= 24) {
            days++;
            hours -= 24;
        }
        if (days < 7) return tweak(days + "d" +" " + hours +"h");
        if (days < 365) return tweak(daysR) + " days";

        let years = Math.floor(days / 365.25);
        let yearsR = Math.round(days / 365.25);
        days = Math.round(days - years*365.25);
        if (days >= 365) {
            years += 1;
            days -= 365;
        }
        if (years<=0) {
            years = 1;
            days = 0;
        }
        if (years < 10) return tweak(years + "y" +" " + days +"d");
        return tweak(yearsR) +" years";
    }

}

export function fromNow(utc) {
    return new MomentPrecise().fromNow(utc);
}

export function duration(utc) {
    return new MomentPrecise().duration(utc);
}
