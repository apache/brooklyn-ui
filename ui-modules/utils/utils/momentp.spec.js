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

/* momentp is like moment.js, but returns more precise humanized output */

import * as mp from "./momentp";
import moment from "moment";

describe('momentp', ()=> {
    it('should evaluate fromNow correctly', ()=> {
        expect(moment(Date.now() + 3000).fromNow()).toBe("in a few seconds");
        expect(moment(Date.now() - 3000).fromNow()).toBe("a few seconds ago");
        // moment will class "12s" as "a few seconds ago"; our routines are more precise
        expect(moment(Date.now() - 12000).fromNow()).toBe("a few seconds ago");

        expect(mp.fromNow(Date.now()
            + 3000)).toBe("in a few seconds");
        expect(new mp.MomentPrecise().setCapitalized(true).fromNow(Date.now() + 3000)).toBe("In a few seconds");
        expect(mp.fromNow(Date.now() - 3000)).toBe("a few seconds ago");
        expect(mp.fromNow(Date.now() - 8000)).toBe("10s ago");
        expect(mp.fromNow(Date.now() - 8123)).toBe("10s ago");
        expect(mp.fromNow(Date.now() - 10123)).toBe("10s ago");
        expect(mp.fromNow(Date.now() - 13123)).toBe("15s ago");
        expect(mp.fromNow(Date.now() - 43123)).toBe("45s ago");
        expect(mp.fromNow(Date.now() - 62123)).toBe("1m 0s ago");
        expect(mp.fromNow(Date.now() - 63123)).toBe("1m 5s ago");
    });

    it('should evaluate duration correctly', ()=> {
        expect(mp.duration(3*1000)).toBe("3s");
        expect(mp.duration(60*1000)).toBe("1m 0s");
        expect(mp.duration(61*1000)).toBe("1m 1s");
        expect(mp.duration(30 * 60*1000)).toBe("30 mins");
        expect(mp.duration(8000)).toBe("8s");
        expect(mp.duration(8123)).toBe("8.1s");
        expect(mp.duration(10123)).toBe("10s");
        expect(mp.duration(59501)).toBe("60s");
        expect(mp.duration(62123)).toBe("1m 2s");
        expect(mp.duration(20*60000 + 2123)).toBe("20 mins");
        expect(mp.duration(62123 + 60*60*1000)).toBe("1h 1m");
        expect(mp.duration(62123 + 8*60*60*1000)).toBe("8 hours");
        expect(mp.duration(-1 + 24*60*60*1000)).toBe("1d 0h");
        expect(mp.duration(62123 + 24*60*60*1000)).toBe("1d 0h");
        expect(mp.duration(62123 + 25*60*60*1000)).toBe("1d 1h");
        expect(mp.duration(62123 + 30*24*60*60*1000)).toBe("30 days");
        expect(mp.duration(62123 + 360*24*60*60*1000)).toBe("360 days");
        expect(mp.duration(62123 + 370*24*60*60*1000)).toBe("1y 5d");
        expect(mp.duration(62123 + 20*365*24*60*60*1000)).toBe("20 years");
    });

});
