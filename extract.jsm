var EXPORTED_SYMBOLS = ["extractor"];
var marker = "--MARK--";

var extractor = {
  findNow: function findNow(email) {
    var now = {};
    
    // use date header
    var re = /^Date:\s\w{3},\s+(\d{1,2})\s(\w{3})\s(\d{4})\s(\d{2}):(\d{1,2})/m;
    var res = re.exec(email);

    now.day = parseInt(res[1], 10);
    switch (res[2]) {
      case "Jan":
        now.month = 1;
        break;
      case "Feb":
        now.month = 2;
        break;
      case "Mar":
        now.month = 3;
        break;
      case "Apr":
        now.month = 4;
        break;
      case "May":
        now.month = 5;
        break;
      case "Jun":
        now.month = 6;
        break;
      case "Jul":
        now.month = 7;
        break;
      case "Aug":
        now.month = 8;
        break;
      case "Sep":
        now.month = 9;
        break;
      case "Oct":
        now.month = 10;
        break;
      case "Now":
        now.month = 11;
        break;
      case "Dec":
        now.month = 12;
        break;
    }
    now.year = parseInt(res[3], 10);
  //   also not likely correct
  //   now.hour = parseInt(res[4], 10);
  //   hardly correct unless sent exactly at meeting start
  //   now.minute = parseInt(res[5], 10);
    
    return now;
  },

  extract: function extract(email, now, bundle) {
    let guess = {};
    guess.year = now.year;
    guess.month = now.month;
    guess.day = now.day;
    guess.hour = now.hour;
    guess.minute = now.minute;
    
    // remove Date: and Sent: lines
    email = email.replace(/^Date:.+$/mg, "");
    email = email.replace(/^Sent:.+$/mg, "");
    email = email.replace(/^Saatmisaeg:.+$/mg, "");
    
    // from less specific to more specific
    
    if (new RegExp(this.getAlternatives(bundle, "tomorrow"), "ig").exec(email)) {
      guess.day++;
    }
    
    // day only
    var alts = this.getRepAlternatives(bundle, "ordinal.date", ["(\\d{1,2})"]);
    for (var alt in alts) {
      let re = new RegExp(alts[alt].pattern, "ig");
      while ((res = re.exec(email)) != null) {
        if (res) {
          res[1] = parseInt(res[1], 10);
          if (this.isValidDay(res[1])) {
            guess.day = res[1];
            break;
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
        date.setDate(now.day);
        date.setMonth(now.month - 1);
        date.setYear(now.year);

        let diff = (i - date.getDay() + 7) % 7;
        date.setDate(date.getDate() + diff);
        
        guess.year = date.getFullYear();
        guess.month = date.getMonth() + 1;
        guess.day = date.getDate();
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
            guess.hour = res[1];
            if (guess.hour < 8)
              guess.hour += 12;
            guess.minute = 0;
            break;
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
            guess.hour = res[1];
            guess.minute = 0;
            break;
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
            guess.hour = res[1] + 12;
            guess.minute = 0;
            break;
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
            guess.hour = res[1];
            guess.minute = 0;
            if (guess.hour < 8)
              guess.hour += 12;
            break;
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
              guess.hour = res[1];
              guess.minute = 0;
              if (guess.hour < 8)
                guess.hour += 12;
              break;
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
            guess.hour = res[1];
            guess.minute = res[2];
            if (guess.hour < 8)
              guess.hour += 12;
            break;
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
            guess.hour = res[1];
            guess.minute = res[2];
            if (res[1] < 8)
              guess.hour += 12;
            break;
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
            guess.hour = res[1];
            guess.minute = res[2];
            break;
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
            guess.hour = res[1];
            guess.minute = res[2];
            if (guess.hour < 12)
              guess.hour += 12;
            break;
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
            guess.day = res[positions[2]];
            for (let i = 0; i < 12; i++) {
              let ms = months[i].unescape().split("|");
              if (ms.indexOf(res[positions[1]].toLowerCase()) != -1) {
                guess.month = i + 1;
                break;
              }
            }
            break;
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
            
            guess.day = res[positions[1]];
            guess.month = res[positions[2]];
            guess.year = res[positions[3]];
            break;
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
            guess.day = res[positions[1]];
            for (let i = 0; i < 12; i++) {
              if (months[i].split("|").indexOf(res[positions[2]].toLowerCase()) != -1) {
                guess.month = i + 1;
                break;
              }
            }
            guess.year = res[positions[3]];
            break;
          }
        }
      }
    }
    
    return guess;
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
