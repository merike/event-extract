/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Event Extractor code.
 *
 * The Initial Developer of the Original Code is
 * Merike Sell.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

var EXPORTED_SYMBOLS = ["extractor"];
var marker = "--MARK--";

var extractor = {
  collected: [],
  
  findNow: function findNow(email) {
    var now = new Date();
    
    // use date header
    var re = /^Date:\s\w{3},\s+(\d{1,2})\s(\w{3})\s(\d{4})\s(\d{2}):(\d{1,2})/m;
    var res = re.exec(email);

    now.setDate(parseInt(res[1], 10));
    switch (res[2]) {
      case "Jan":
        now.setMonth(0);
        break;
      case "Feb":
        now.setMonth(1);
        break;
      case "Mar":
        now.setMonth(2);
        break;
      case "Apr":
        now.setMonth(3);
        break;
      case "May":
        now.setMonth(4);
        break;
      case "Jun":
        now.setMonth(5);
        break;
      case "Jul":
        now.setMonth(6);
        break;
      case "Aug":
        now.setMonth(7);
        break;
      case "Sep":
        now.setMonth(8);
        break;
      case "Oct":
        now.setMonth(9);
        break;
      case "Now":
        now.setMonth(10);
        break;
      case "Dec":
        now.setMonth(11);
        break;
    }
    now.setFullYear(parseInt(res[3], 10));
    now.setHours(parseInt(res[4], 10));
    now.setMinutes(parseInt(res[5], 10));
    
    return now;
  },

  extract: function extract(email, now, bundle) {
    let initial = {};
    initial.year = now.getFullYear();
    initial.month = now.getMonth() + 1;
    initial.day = now.getDate();
    initial.hour = now.getHours();
    initial.minute = now.getMinutes();
    this.collected = [];
    
    this.collected.push({year: initial.year,
                         month: initial.month,
                         day: initial.day});
    this.collected.push({hour: initial.hour,
                         minute: initial.minute});
    
    // remove Date: and Sent: lines
    email = email.replace(/^Date:.+$/mg, "");
    email = email.replace(/^Sent:.+$/mg, "");
    email = email.replace(/^Saatmisaeg:.+$/mg, "");
    
    // from less specific to more specific
    let re = new RegExp(this.getAlternatives(bundle, "tomorrow"), "ig");
    if ((res = re.exec(email)) != null) {
        let item = new Date(now.getTime() + 60 * 60 * 24 * 1000);
        this.collected.push({year: item.getFullYear(),
                             month: item.getMonth() + 1,
                             day: item.getDate(),
                             start: res.index, end: res.index + res[0].length
        });
    }
    
    // day only
    var alts = this.getRepAlternatives(bundle, "ordinal.date", ["(\\d{1,2})"]);
    for (var alt in alts) {
      let re = new RegExp(alts[alt].pattern, "ig");
      while ((res = re.exec(email)) != null) {
        if (res) {
          res[1] = parseInt(res[1], 10);
          if (this.isValidDay(res[1])) {
            let item = new Date(now.getTime());
            if (now.getDate() > res[1]) {
              // find next nth date
              while (true) {
                item.setDate(item.getDate() + 1);
                if (item.getMonth() != now.getMonth() &&
                  item.getDate() == res[1])
                  break;
              }
            }
            this.collected.push({year: item.getFullYear(),
                                 month: item.getMonth() + 1,
                                 day: res[1],
                                 start: res.index, end: res.index + res[0].length});
          }
        }
      }
    }
    
    // weekday
    let days = [];
    for (let i = 0; i < 7; i++) {
      days[i] = this.getAlternatives(bundle, "weekday." + i);
      let re = new RegExp(days[i], "ig");
      res = re.exec(email);
      if (res) {
        let date = new Date();
        date.setDate(now.getDate());
        date.setMonth(now.getMonth());
        date.setYear(now.getFullYear());

        let diff = (i - date.getDay() + 7) % 7;
        date.setDate(date.getDate() + diff);
        
        this.collected.push({year: date.getFullYear(),
                             month: date.getMonth() + 1,
                             day: date.getDate(),
                             start: res.index, end: res.index + res[0].length
        });
      }
    }
    
    // time only
    alts = this.getRepAlternatives(bundle, "hour.only", ["(\\d{1,2})"]);
    for (var alt in alts) {
      let re = new RegExp(alts[alt].pattern, "ig");
      while ((res = re.exec(email)) != null) {
        if (res) {
          res[1] = parseInt(res[1], 10);
          if (this.isValidHour(res[1])) {
            if (res[1] < 8)
              this.collected.push({hour: res[1] + 12, minute: 0,
                              start: res.index, end: res.index + res[0].length
              });
            else
              this.collected.push({hour: res[1], minute: 0,
                              start: res.index, end: res.index + res[0].length
              });
          }
        }
      }
    }
    
    alts = this.getRepAlternatives(bundle, "am.hour.only", ["(\\d{1,2})"]);
    for (var alt in alts) {
      let re = new RegExp(alts[alt].pattern, "ig");
      while ((res = re.exec(email)) != null) {
        if (res) {
          res[1] = parseInt(res[1], 10);
          if (this.isValidHour(res[1])) {
            this.collected.push({hour: res[1], minute: 0,
                            start: res.index, end: res.index + res[0].length
            });
          }
        }
      }
    }
      
    alts = this.getRepAlternatives(bundle, "pm.hour.only", ["(\\d{1,2})"]);
    for (var alt in alts) {
      let re = new RegExp(alts[alt].pattern, "ig");
      while ((res = re.exec(email)) != null) {
        if (res) {
          res[1] = parseInt(res[1], 10);
          if (this.isValidHour(res[1])) {
            this.collected.push({hour: res[1] + 12, minute: 0,
                            start: res.index, end: res.index + res[0].length
            });
          }
        }
      }
    }
    
    alts = this.getRepAlternatives(bundle, "duration.full.hours", ["(\\d{1,2})","(\\d{1,2})"]);
    for (var alt in alts) {
      let re = new RegExp(alts[alt].pattern, "ig");
      while ((res = re.exec(email)) != null) {
        if (res) {
          res[1] = parseInt(res[1], 10);
          if (this.isValidHour(res[1])) {
            if (res[1] < 8)
              this.collected.push({hour: res[1] + 12, minute: 0,
                              start: res.index, end: res.index + res[0].length
              });
            else
              this.collected.push({hour: res[1], minute: 0,
                              start: res.index, end: res.index + res[0].length
              });
          }
        }
      }
    }
    
    alts = this.getRepAlternatives(bundle, "duration.full.hour.to.minutes", ["(\\d{1,2})","(\\d{1,2})", "(\\d{2})"]);
    for (var alt in alts) {
      let re = new RegExp(alts[alt].pattern, "ig");
      while ((res = re.exec(email)) != null) {
        if (res) {
            res[1] = parseInt(res[1], 10);
            if (this.isValidHour(res[1])) {
              if (res[1] < 8)
                this.collected.push({hour: res[1] + 12, minute: 0,
                                start: res.index, end: res.index + res[0].length
                });
              else
                this.collected.push({hour: res[1], minute: 0,
                                start: res.index, end: res.index + res[0].length
                });
            }
        }
      }
    }
    
    alts = this.getRepAlternatives(bundle, "duration.minutes.to.minutes", ["(\\d{1,2})", "(\\d{2})","(\\d{1,2})", "(\\d{2})"]);
    for (var alt in alts) {
      let re = new RegExp(alts[alt].pattern, "ig");
      while ((res = re.exec(email)) != null) {
        if (res) {
          res[1] = parseInt(res[1], 10);
          res[2] = parseInt(res[2], 10);
          if (this.isValidHour(res[1]) && this.isValidMinute(res[2])) {
            if (res[1] < 8)
              this.collected.push({hour: res[1] + 12, minute: res[2],
                              start: res.index, end: res.index + res[0].length
              });
            else
              this.collected.push({hour: res[1], minute: res[2],
                              start: res.index, end: res.index + res[0].length
              });
          }
        }
      }
    }
    
    // hour:minutes
    alts = this.getRepAlternatives(bundle, "hour.minutes", ["(\\d{1,2})","(\\d{2})"]);
    for (var alt in alts) {
      let re = new RegExp(alts[alt].pattern, "ig");
      while ((res = re.exec(email)) != null) {
        if (res) {
          res[1] = parseInt(res[1], 10);
          res[2] = parseInt(res[2], 10);
          // unlikely meeting time, XXX should consider working hours
          if (this.isValidHour(res[1]) && this.isValidMinute(res[2])) {
            if (res[1] < 8)
              this.collected.push({hour: res[1] + 12, minute: res[2],
                              start: res.index, end: res.index + res[0].length
              });
            else
              this.collected.push({hour: res[1], minute: res[2],
                              start: res.index, end: res.index + res[0].length
              });
          }          
        }
      }
    }

    alts = this.getRepAlternatives(bundle, "hour.minutes.am", ["(\\d{1,2})", "(\\d{2})"]);
    for (var alt in alts) {
      let re = new RegExp(alts[alt].pattern, "ig");
      while ((res = re.exec(email)) != null) {
        if (res) {
          res[1] = parseInt(res[1], 10);
          res[2] = parseInt(res[2], 10);
          if (this.isValidHour(res[1]) && this.isValidMinute(res[2])) {
            this.collected.push({hour: res[1], minute: res[2],
                            start: res.index, end: res.index + res[0].length
            });
          }
        }
      }
    }
    
    alts = this.getRepAlternatives(bundle, "hour.minutes.pm", ["(\\d{1,2})", "(\\d{2})"]);
    for (var alt in alts) {
      let re = new RegExp(alts[alt].pattern, "ig");
      while ((res = re.exec(email)) != null) {
        if (res) {
          res[1] = parseInt(res[1], 10);
          res[2] = parseInt(res[2], 10);
          if (this.isValidHour(res[1]) && this.isValidMinute(res[2])) {
            this.collected.push({hour: res[1] + 12, minute: res[2],
                            start: res.index, end: res.index + res[0].length
            });
          }
        }
      }
    }

    // month with day
    let months = [];
    for (let i = 0; i < 12; i++) {
      months[i] = this.getAlternatives(bundle, "month." + (i + 1));
    }
    // | is both used as pattern separator and within patterns
    // ignore those within patterns temporarily
    let allMonths = months.join(marker).replace("|", marker, "g");
    alts = this.getRepAlternatives(bundle, "month.day", ["(" + allMonths + ")", "(\\d{1,2})"]);
    for (var alt in alts) {
      let pattern = alts[alt].pattern.replace(marker, "|", "g");
      let positions = alts[alt].positions;

      let re = new RegExp(pattern, "ig");
      while ((res = re.exec(email)) != null) {
        if (res) {
          res[positions[2]] = parseInt(res[positions[2]], 10);
          if (this.isValidDay(res[positions[2]])) {
            for (let i = 0; i < 12; i++) {
              let ms = months[i].unescape().split("|");
              if (ms.indexOf(res[positions[1]].toLowerCase()) != -1) {
                let year = now.getFullYear();
                if (now > new Date(year, i, res[positions[2]]))
                  year++;
                this.collected.push({year: year,
                                     month: i + 1,
                                     day: res[positions[2]],
                                     start: res.index, end: res.index + res[0].length
                });
                break;
              }
            }
          }
        }
      }
    }
    
    // date with year
    alts = this.getRepAlternatives(bundle, "day.numericmonth.year",
                              ["(\\d{1,2})", "(\\d{1,2})", "(\\d{2,4})" ]);
    for (var alt in alts) {
      let pattern = alts[alt].pattern;
      let positions = alts[alt].positions;

      let re = new RegExp(pattern, "ig");
      while ((res = re.exec(email)) != null) {
        if (res) {
          res[positions[1]] = parseInt(res[positions[1]], 10);
          res[positions[2]] = parseInt(res[positions[2]], 10);
          if (res[positions[3]].length == 2)
            res[positions[3]] = "20" + res[positions[3]];
          res[positions[3]] = parseInt(res[positions[3]], 10);
          if (this.isValidDay(res[positions[1]]) && 
            this.isValidMonth(res[positions[2]]) && 
            this.isValidYear(res[positions[3]])) {
            
            this.collected.push({year: res[positions[3]],
                            month: res[positions[2]],
                            day: res[positions[1]],
                            start: res.index, end: res.index + res[0].length
            });
          }
        }
      }
    }
    
    alts = this.getRepAlternatives(bundle, "day.monthname.year",
                              ["(\\d{1,2})", "(" + allMonths + ")", "(\\d{2,4})" ]);
    for (var alt in alts) {
      let pattern = alts[alt].pattern.replace(marker, "|", "g");
      let positions = alts[alt].positions;

      let re = new RegExp(pattern, "ig");
      
      while ((res = re.exec(email)) != null) {
        if (res) {
          res[positions[1]] = parseInt(res[positions[1]], 10);
          if (res[positions[3]].length == 2)
              res[positions[3]] = "20" + res[positions[3]];
          res[positions[3]] = parseInt(res[positions[3]], 10);
          if (this.isValidDay(res[positions[1]])) {
            for (let i = 0; i < 12; i++) {
              if (months[i].split("|").indexOf(res[positions[2]].toLowerCase()) != -1) {
                this.collected.push({year: res[positions[3]],
                                month: i + 1,
                                day: res[positions[1]],
                                start: res.index, end: res.index + res[0].length
                });
                break;
              }
            }
          }
        }
      }
    }
    
    this.markContained();
    return this.collected;
  },
  
  markContained: function markContained() {
    for (let first = 0; first < this.collected.length; first++) {
      for (let second = 0; second < this.collected.length; second++) {
        if (first != second && 
            this.collected[first].start && this.collected[first].end &&
            this.collected[second].start && this.collected[second].end &&
            this.collected[second].start >= this.collected[first].start &&
            this.collected[second].end <= this.collected[first].end) {
            this.collected[second].use = false;
        }
      }
    }
  },
  
  guessStart: function guessStart(collected) {
    if (collected.length == 0)
      return {};
    else {
      let sort = function(one, two) {
        // sort the guess from email date as the last one
        if (one.start == undefined && two.start != undefined) {
          return 1;
        } else if (one.start != undefined && two.start == undefined) {
          return -1;
        } else if (one.start == undefined && two.start == undefined) {
          return 0;
          // sort dates before times
        } else if (one.year != undefined && two.year == undefined) {
          return -1;
        } else if (one.year == undefined && two.year != undefined) {
          return 1;
        } else if (one.year != undefined && two.year != undefined) {
          if (one.year < two.year) {
            return -1;
          } else if (one.year > two.year) {
            return 1;
          } else {
            if (one.month < two.month) {
              return -1;
            } else if (one.month > two.month) {
              return 1;
            } else {
              if (one.day < two.day) {
                return -1;
              } else if (one.day > two.day) {
                return 1;
              } else {
                return 0;
              }
            }
          }
        } else {
          if (one.hour < two.hour) {
            return -1;
          } else if (one.hour > two.hour) {
            return 1;
          } else {
            if (one.minute < two.minute) {
              return -1;
            } else if (one.minute > two.minute) {
              return 1;
            } else {
              return 0;
            }
          }
        }
      }
      
      collected.sort(sort);
      
      /*for (val in collected) {
        if (collected[val].use != false)
          dump(JSON.stringify(collected[val]) + "\n");
      }*/
      
      var guess = {};
      /*let withYear = collected.filter(function(val) {
        return (val.year != undefined && val.use != false);});
      let withMonth = collected.filter(function(val) {
        return (val.month != undefined && val.use != false);});*/
      let withDay = collected.filter(function(val) {
        return (val.day != undefined && val.use != false);});
      /*let withHour = collected.filter(function(val) {
        return (val.hour != undefined && val.use != false);});*/
      let withMinute = collected.filter(function(val) {
        return (val.minute != undefined && val.use != false);});
      
      guess.year = withDay[0].year;
      guess.month = withDay[0].month;
      guess.day = withDay[0].day;
      guess.hour = withMinute[0].hour;
      guess.minute = withMinute[0].minute;
      
      return guess;
    }
  },

  getAlternatives: function getAlternatives(bundle, name) {
    let value = bundle.GetStringFromName(name);
    value = value.replace(" |", "|", "g").replace("| ", "|", "g");
    return value.sanitize();
  },

  getRepAlternatives: function getRepAlternatives(bundle, name, replaceables) {
    let value = bundle.formatStringFromName(name, replaceables, replaceables.length);
    value = value.replace(" |", "|", "g").replace("| ", "|", "g");
    value = value.sanitize();
    let patterns = value.split("|");
    
    let rawValues = this.getAlternatives(bundle, name).split("|");
    
    let alts = new Array();
    let i = 0;
    for (var pattern in patterns) {
      // XXX only add information when more than 1 replaceables, not needed otherwise
      let positions = this.getPositionsFor(rawValues[i]);
      alts[i] = {pattern: patterns[i], positions: positions};
      i++;
    }
    
    return alts;
  },

  getPositionsFor: function getPositionsFor(s) {
    let positions = new Array();
    let re = /\%(\d)\$S/g;
    let match = true;
    let i = 0;
    while (true) {
      i++;
      match = re.exec(s);
      if (!match)
        break;
      positions[parseInt(match[1], 10)] = i;
    }
    
    return positions;
  },
  
  isValidYear: function isValidYear(year) {
    if (year >= 2000  && year <= 2050) return true;
    else return false;
  },
  
  isValidMonth: function isValidMonth(month) {
    if (month >= 1 && month <= 12) return true;
    else return false;
  },
  
  isValidDay: function isValidDay(day) {
    if (day >= 1 && day <= 31) return true;
    else return false;
  },
  
  isValidHour: function isValidHour(hour) {
    if (hour >= 0 && hour <= 23) return true;
    else return false;
  },
  
  isValidMinute: function isValidMinute(minute) {
    if (minute >= 0 && minute <= 59) return true;
    else return false;
  }
}

// XXX should replace all special characters for regexp not just .
String.prototype.sanitize = function() {
  let res = this.replace(/([^\\])([\.])/g, "$1\\$2");
  return res;
}

String.prototype.unescape = function() {
  let res = this.replace(/\\([\.])/g, "$1");
  return res;
}
