/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var EXPORTED_SYMBOLS = ["extractor"];
Components.utils.import("resource://calendar/modules/calUtils.jsm");

var extractor = {
  email: "",
  marker: "--MARK--",
  collected: [],
  numbers: [],
  hourlyNumbers: [],
  dailyNumbers: [],
  allMonths: "",
  months: [],
  dayStart: 6,
  now: undefined,
  bundleFile: "",
  bundle: "",
  fallbackLocale: "",
  overrides: {},
  fixedLang: true,
  aConsoleService: Components.classes["@mozilla.org/consoleservice;1"]
                  .getService(Components.interfaces.nsIConsoleService),

  init: function init(baseUrl, fallbackLocale, dayStart) {
    this.bundleFile = baseUrl;
    this.fallbackLocale = fallbackLocale;
    
    if (dayStart != undefined)
      this.dayStart = dayStart;
  },
  
  /**
   * Removes confusing data like urls, timezones and phone numbers from email
   * Also removes standard signatures and quoted content from previous emails
   */
  cleanup: function cleanup() {
    // remove Date: and Sent: headers
    // only necessary with saved emails outside of extension
    this.email = this.email.replace(/^Date:.+$/m, "");
    this.email = this.email.replace(/^Sent:.+$/m, "");
    this.email = this.email.replace(/^Saatmisaeg:.+$/m, "");
    
    // XXX remove earlier correspondence
    // ideally this should be considered with lower certainty to fill missing information
    // remove last line preceeding quoted message and first line of the quote
    this.email = this.email.replace(/\r?\n[^>].*\r?\n>+.*$/m, "");
    // remove the rest of quoted content
    this.email = this.email.replace(/^>+.*$/gm, "");
    
    // remove empty lines
    this.email = this.email.replace(/<br ?\/?>/gm, "");
    this.email = this.email.replace(/^\s[ \t]*$/gm, "");
    
    // urls often contain dates dates that can confuse extraction
    this.email = this.email.replace(/https?:\/\/[^\s]+\s/gm, "");
    this.email = this.email.replace(/www\.[^\s]+\s/gm, "");
    
    // remove phone numbers
    // TODO allow locale specific configuration of formats
    this.email = this.email.replace(/\d-\d\d\d-\d\d\d-\d\d\d\d/gm, "");
    
    // remove standard signature
    this.email = this.email.replace(/\r?\n-- \r?\n[\S\s]+$/, "");
    
    // XXX remove timezone info, for now
    this.email = this.email.replace(/gmt[+-]\d{2}:\d{2}/gi, "");
  },
  
  checkBundle: function checkBundle(locale) {
    let service = Components.classes["@mozilla.org/intl/stringbundle;1"]
                 .getService(Components.interfaces.nsIStringBundleService);
    let bundle = service.createBundle(this.bundleFile.replace("LOCALE", locale, "g"));
    
    try {
      bundle.formatStringFromName("from.today", [], 0);
      return true;
    } catch (ex) {
      return false;
    }
  },
  
  avgNonAsciiCharCode: function avgNonAsciiCharCode(email) {
    let sum = 0;
    let cnt = 0;
    
    for (let i = 0; i < email.length; i++) {
      let ch = email.charCodeAt(i);
      if (ch > 128) {
          sum += ch;
          cnt++;
      }
    }
    
    let nonAscii = sum/cnt || 0;
    this.aConsoleService.logStringMessage("Average non-ascii charcode: " + nonAscii);
//     dump("Average non-ascii charcode: " + nonAscii + "\n");
    return nonAscii;
  },
  
  setLanguage: function setLanguage(email) {
    let service = Components.classes["@mozilla.org/intl/stringbundle;1"]
                  .getService(Components.interfaces.nsIStringBundleService);
    
    if (this.fixedLang == true) {
      if (this.checkBundle(this.fallbackLocale)) {
        ;
      } else if (this.checkBundle(this.fallbackLocale.substring(0, 2))) {
        this.fallbackLocale = this.fallbackLocale.substring(0, 2);
      } else {
        this.fallbackLocale = "en-US";
      }
      
      this.bundle = service.createBundle(this.bundleFile.replace("LOCALE", this.fallbackLocale, "g"));
      this.aConsoleService.logStringMessage("Application locale was used to choose " + this.fallbackLocale + " patterns.");
    } else {
      let spellclass = "@mozilla.org/spellchecker/engine;1";
      let gSpellCheckEngine = Components.classes[spellclass]
                        .createInstance(Components.interfaces.mozISpellCheckingEngine);
      
      let arr = {};
      let cnt = {};
      gSpellCheckEngine.getDictionaryList(arr, cnt);
      let dicts = arr["value"];
      
      if (dicts.length == 0)
        this.aConsoleService.logStringMessage("There are no dictionaries installed and enabled. You might want to add some if date and time extraction from emails seems inaccurate.");
      
      let patterns;
      let words = email.split(/\s+/);
      let most = 0;
      let mostLocale;
      for (let dict in dicts) {
        // dictionary locale and patterns locale match
        if (this.checkBundle(dicts[dict])) {
          let t1 = (new Date()).getTime();
          gSpellCheckEngine.dictionary = dicts[dict];
          let dur = (new Date()).getTime() - t1;
          this.aConsoleService.logStringMessage("Loading " + dicts[dict] + " dictionary took " + dur + "ms\n");
          patterns = dicts[dict];
        // beginning of dictionary locale matches patterns locale
        } else if (this.checkBundle(dicts[dict].substring(0, 2))) {
          let t1 = (new Date()).getTime();
          gSpellCheckEngine.dictionary = dicts[dict];
          let dur = (new Date()).getTime() - t1;
          this.aConsoleService.logStringMessage("Loading " + dicts[dict] + " dictionary took " + dur + "ms\n");
          patterns = dicts[dict].substring(0, 2);
        // dictionary for which patterns aren't present
        } else {
          this.aConsoleService.logStringMessage("Dictionary present, rules missing: " + dicts[dict]);
          continue;
        }
        
        let correct = 0;
        let total = 0;
        for (let word in words) {
          words[word] = words[word].replace(/[()\d,;:?!#\.]/g, "");
          if (words[word].length >= 2) {
            total++;
            if (gSpellCheckEngine.check(words[word]))
              correct++;
          }
        }
        
        let percentage = correct/total * 100.0;
        this.aConsoleService.logStringMessage(dicts[dict] + " dictionary matches " + percentage + "% of words");
        
        if (percentage > 50.0 && percentage > most) {
          mostLocale = patterns;
          most = percentage;
        }
      }
      
      let avgCharCode = this.avgNonAsciiCharCode(email);
      
      // using dictionaries for language recognition with non-latin letters doesn't work very well
      // possibly because of bug 471799
      if (avgCharCode > 24000 && avgCharCode < 32000) {
        this.aConsoleService.logStringMessage("Using zh-TW patterns");
        this.bundle = service.createBundle(this.bundleFile.replace("LOCALE", "zh-TW", "g"));
      } else if (avgCharCode > 14000 && avgCharCode < 24000) {
        this.aConsoleService.logStringMessage("Using ja patterns");
        this.bundle = service.createBundle(this.bundleFile.replace("LOCALE", "ja", "g"));
      } else if (avgCharCode > 1000 && avgCharCode < 1200) {
        this.aConsoleService.logStringMessage("Using ru patterns");
        this.bundle = service.createBundle(this.bundleFile.replace("LOCALE", "ru", "g"));
      // dictionary based
      } else if (most > 0) {
        this.aConsoleService.logStringMessage("Using " + mostLocale + " patterns based on dictionary");
        this.bundle = service.createBundle(this.bundleFile.replace("LOCALE", mostLocale, "g"));
      // fallbackLocale matches patterns exactly
      } else if (this.checkBundle(this.fallbackLocale)) {
        this.aConsoleService.logStringMessage("Falling back to " + this.fallbackLocale);
        this.bundle = service.createBundle(this.bundleFile.replace("LOCALE", this.fallbackLocale, "g"));
      // beginning of fallbackLocale matches patterns
      } else if (this.checkBundle(this.fallbackLocale.substring(0, 2))) {
        this.fallbackLocale = this.fallbackLocale.substring(0, 2);
        this.aConsoleService.logStringMessage("Falling back to " + this.fallbackLocale);
        this.bundle = service.createBundle(this.bundleFile.replace("LOCALE", this.fallbackLocale, "g"));
      } else {
        this.aConsoleService.logStringMessage("Using en-US");
        this.bundle = service.createBundle(this.bundleFile.replace("LOCALE", "en-US", "g"));
      }
    }
  },

  /**
   * Extracts dates, times and durations from email
   * 
   * @param body  email body
   * @param now   reference time against which relative times are interpreted
   * @param sel   selection object of email content, when not null times
   *                outside selection are disgarded
   * @param title email title
   * @return      sorted list of extracted datetime objects
   */
  extract: function extract(title, body, now, sel) {
    let initial = {};
    this.collected = [];
    this.email = title + "\r\n" + body;
    this.now = now;
    
    initial.year = now.getFullYear();
    initial.month = now.getMonth() + 1;
    initial.day = now.getDate();
    initial.hour = now.getHours();
    initial.minute = now.getMinutes();
    
    this.collected.push({year: initial.year,
                         month: initial.month,
                         day: initial.day,
                         hour: initial.hour,
                         minute: initial.minute,
                         relation: "start"
    });
    
    this.cleanup();
    this.aConsoleService.logStringMessage("Email after processing for extraction: \n" + this.email);
    
    try {
      this.fixedLang = cal.getPrefSafe("calendar.patterns.fixed.locale", true);
      this.overrides = cal.getPrefSafe("calendar.patterns.override", {});
    } catch (ex) {}
    
    this.setLanguage(this.email);
    
    for (let i = 0; i <= 31; i++) {
      this.numbers[i] = this.getAlternatives("number." + i);
    }
    this.dailyNumbers = this.numbers.join(this.marker);
    
    this.hourlyNumbers =  this.numbers[0] + this.marker;
    for (let i = 1; i <= 22; i++) {
      this.hourlyNumbers += this.numbers[i] + this.marker;
    }
    this.hourlyNumbers += this.numbers[23];
    
    this.hourlyNumbers = this.hourlyNumbers.replace("|", this.marker, "g");
    this.dailyNumbers = this.dailyNumbers.replace("|", this.marker, "g");
    
    for (let i = 0; i < 12; i++) {
      this.months[i] = this.getAlternatives("month." + (i + 1));
    }
    this.allMonths = this.months.join(this.marker).replace("|", this.marker, "g");
    
    // time
    this.extractTime("from.noon", "start", 12, 0);
    this.extractTime("until.noon", "end", 12, 0);
    
    this.extractHour("from.hour", "start", "none");
    this.extractHour("from.hour.am", "start", "ante");
    this.extractHour("from.hour.pm", "start", "post");
    this.extractHour("until.hour", "end", "none");
    this.extractHour("until.hour.am", "end", "none");
    this.extractHour("until.hour.pm", "end", "none");
    
    this.extractHalfHour("from.half.hour.before", "start", "ante");
    this.extractHalfHour("until.half.hour.before", "end", "ante");
    this.extractHalfHour("from.half.hour.after", "start", "post");
    this.extractHalfHour("until.half.hour.after", "end", "post");
    
    this.extractHourMinutes("from.hour.minutes", "start", "none");
    this.extractHourMinutes("from.hour.minutes.am", "start", "ante");
    this.extractHourMinutes("from.hour.minutes.pm", "start", "post");
    this.extractHourMinutes("until.hour.minutes", "end", "none");
    this.extractHourMinutes("until.hour.minutes.am", "end", "ante");
    this.extractHourMinutes("until.hour.minutes.pm", "end", "post");
    
    // date
    this.extractRelativeDay("from.today", "start", 0);
    this.extractRelativeDay("from.tomorrow", "start", 1);
    this.extractRelativeDay("until.tomorrow", "end", 1);
    this.extractWeekDay("from.weekday.", "start");
    this.extractWeekDay("until.weekday.", "end");
    this.extractDate("from.ordinal.date", "start");
    this.extractDate("until.ordinal.date", "end");
    
    this.extractDayMonth("from.month.day", "start");
    this.extractDayMonthYear("from.year.month.day", "start");
    this.extractDayMonth("until.month.day", "end");
    this.extractDayMonthYear("until.year.month.day", "end");
    this.extractDayMonthName("from.monthname.day", "start");
    this.extractDayMonthNameYear("from.year.monthname.day", "start");
    this.extractDayMonthName("until.monthname.day", "end");
    this.extractDayMonthNameYear("until.year.monthname.day", "end");
    
    // duration
    this.extractDuration("duration.minutes", 1);
    this.extractDuration("duration.hours", 60);
    this.extractDuration("duration.days", 60 * 24);
    
    if (sel != undefined)
      this.markSelected(sel, title);
    this.markContained();
    this.collected = this.collected.sort(this.sort);
    
    return this.collected;
  },
  
  extractDayMonthYear: function extractDayMonthYear(pattern, relation) {
    let alts = this.getRepAlternatives(pattern,
                              ["(\\d{1,2})", "(\\d{1,2})", "(\\d{2,4})" ]);
    let res;
    for (let alt in alts) {
      let positions = alts[alt].positions;
      let re = new RegExp(alts[alt].pattern, "ig");
      
      while ((res = re.exec(this.email)) != null) {
        if (res && !this.restrictNumbers(res, this.email) && !this.restrictChars(res, this.email)) {
          res[positions[1]] = parseInt(res[positions[1]], 10);
          res[positions[2]] = parseInt(res[positions[2]], 10);
          res[positions[3]] = this.normalizeYear(res[positions[3]]);
          res[positions[3]] = parseInt(res[positions[3]], 10);
          
          if (this.isValidDay(res[positions[1]]) && 
            this.isValidMonth(res[positions[2]]) && 
            this.isValidYear(res[positions[3]])) {
            
            let rev = this.prefixSuffixStartEnd(res, relation, this.email);
            this.guess(res[positions[3]], res[positions[2]], res[positions[1]],
                       undefined, undefined,
                       rev.start, rev.end,
                       rev.pattern, rev.relation, pattern);
          }
        }
      }
    }
  },
  
  extractDayMonthNameYear: function extractDayMonthNameYear(pattern, relation) {
    let alts = this.getRepAlternatives(pattern, ["(\\d{1,2})",
                                      "(" + this.allMonths + ")", "(\\d{2,4})" ]);
    let res;
    for (let alt in alts) {
      let exp = alts[alt].pattern.replace(this.marker, "|", "g");
      let positions = alts[alt].positions;
      let re = new RegExp(exp, "ig");
      
      while ((res = re.exec(this.email)) != null) {
        if (res && !this.restrictNumbers(res, this.email) && !this.restrictChars(res, this.email)) {
          res[positions[1]] = parseInt(res[positions[1]], 10);
          res[positions[3]] = this.normalizeYear(res[positions[3]]);
          res[positions[3]] = parseInt(res[positions[3]], 10);

          if (this.isValidDay(res[positions[1]])) {
            for (let i = 0; i < 12; i++) {
              if (this.months[i].split("|").indexOf(res[positions[2]].toLowerCase()) != -1) {
                let rev = this.prefixSuffixStartEnd(res, relation, this.email);
                this.guess(res[positions[3]], i + 1, res[positions[1]],
                           undefined, undefined,
                           rev.start, rev.end,
                           rev.pattern, rev.relation, pattern);
                break;
              }
            }
          }
        }
      }
    }  
  },
  
  extractRelativeDay: function extractRelativeDay(pattern, relation, offset) {
    let re = new RegExp(this.getAlternatives(pattern), "ig");
    let res;
    if ((res = re.exec(this.email)) != null) {
      if (!this.restrictChars(res, this.email)) {
        let item = new Date(this.now.getTime() + 60 * 60 * 24 * 1000 * offset);
        let rev = this.prefixSuffixStartEnd(res, relation, this.email);
        this.guess(item.getFullYear(), item.getMonth() + 1, item.getDate(),
                   undefined, undefined,
                   rev.start, rev.end,
                   rev.pattern, rev.relation, pattern);
      }
    }
  },
  
  extractDayMonthName: function extractDayMonthName(pattern, relation) {
    let alts = this.getRepAlternatives(pattern,
                                   ["(\\d{1,2}" + this.marker + this.dailyNumbers + ")",
                                   "(" + this.allMonths + ")"]);
    let res;
    for (let alt in alts) {
      let exp = alts[alt].pattern.replace(this.marker, "|", "g");
      let positions = alts[alt].positions;
      let re = new RegExp(exp, "ig");
      
      while ((res = re.exec(this.email)) != null) {
        if (res && !this.restrictNumbers(res, this.email) && !this.restrictChars(res, this.email)) {
          res[positions[1]] = this.parseNumber(res[positions[1]], this.numbers);
          if (this.isValidDay(res[positions[1]])) {
            for (let i = 0; i < 12; i++) {
              let ms = this.months[i].unescape().split("|");
              if (ms.indexOf(res[positions[2]].toLowerCase()) != -1) {
                let date = {year: this.now.getFullYear(), month: i + 1, day: res[positions[1]]};
                if (this.isPastDate(date, this.now)) {
                  // find next such date
                  let item = new Date(this.now.getTime());
                  while (true) {
                    item.setDate(item.getDate() + 1);
                    if (item.getMonth() == date.month - 1  &&
                      item.getDate() == date.day) {
                        date.year = item.getFullYear();
                        break;
                      }
                  }
                }
                
                let rev = this.prefixSuffixStartEnd(res, relation, this.email);
                this.guess(date.year, date.month, date.day,
                       undefined, undefined,
                       rev.start, rev.end,
                       rev.pattern, rev.relation, pattern);
                break;
              }
            }
          }
        }
      }
    }
  },
  
  extractDayMonth: function extractDayMonth(pattern, relation) {
    let alts = this.getRepAlternatives(pattern, ["(\\d{1,2})", "(\\d{1,2})"]);
    let res;
    for (let alt in alts) {
      let re = new RegExp(alts[alt].pattern, "ig");
      while ((res = re.exec(this.email)) != null) {
        if (res && !this.restrictNumbers(res, this.email) && !this.restrictChars(res, this.email)) {
          res[1] = parseInt(res[1], 10);
          res[2] = parseInt(res[2], 10);
          
          if (this.isValidMonth(res[2]) && this.isValidDay(res[1])) {
            let date = {year: this.now.getFullYear(), month: res[2], day: res[1]};
            
            if (this.isPastDate(date, this.now)) {
              // find next such date
              let item = new Date(this.now.getTime());
              while (true) {
                item.setDate(item.getDate() + 1);
                if (item.getMonth() == date.month - 1  &&
                  item.getDate() == date.day) {
                    date.year = item.getFullYear();
                    break;
                  }
              }
            }
            
            let rev = this.prefixSuffixStartEnd(res, relation, this.email);            this.guess(date.year, date.month, date.day,
                       undefined, undefined,
                       rev.start, rev.end,
                       rev.pattern, rev.relation, pattern);
          }
        }
      }
    }
  },
  
  extractDate: function extractDate (pattern, relation) {
    let alts = this.getRepAlternatives(pattern,
                                       ["(\\d{1,2}" + this.marker + this.dailyNumbers + ")"]);
    let res;
    for (let alt in alts) {
      let exp = alts[alt].pattern.replace(this.marker, "|", "g");
      let re = new RegExp(exp, "ig");
      
      while ((res = re.exec(this.email)) != null) {
        if (res && !this.restrictNumbers(res, this.email) && !this.restrictChars(res, this.email)) {
          res[1] = this.parseNumber(res[1], this.numbers);
          if (this.isValidDay(res[1])) {
            let item = new Date(this.now.getTime());
            if (this.now.getDate() > res[1]) {
              // find next nth date
              while (true) {
                item.setDate(item.getDate() + 1);
                if (item.getMonth() != this.now.getMonth() &&
                  item.getDate() == res[1])
                  break;
              }
            }
            
            let rev = this.prefixSuffixStartEnd(res, relation, this.email);
            this.guess(item.getFullYear(), item.getMonth() + 1, res[1],
                       undefined, undefined,
                       rev.start, rev.end,
                       rev.pattern, rev.relation, pattern, true);
          }
        }
      }
    }
  },
  
  extractWeekDay: function extractWeekDay(pattern, relation) {
    let days = [];
    for (let i = 0; i < 7; i++) {
      days[i] = this.getAlternatives(pattern + i);
      let re = new RegExp(days[i], "ig");
      let res = re.exec(this.email);
      if (res) {
        if (!this.restrictChars(res, this.email)) {
          let date = new Date();
          date.setDate(this.now.getDate());
          date.setMonth(this.now.getMonth());
          date.setYear(this.now.getFullYear());

          let diff = (i - date.getDay() + 7) % 7;
          date.setDate(date.getDate() + diff);

          let rev = this.prefixSuffixStartEnd(res, relation, this.email);
          this.guess(date.getFullYear(), date.getMonth() + 1, date.getDate(),
                     undefined, undefined,
                     rev.start, rev.end,
                     rev.pattern, rev.relation, pattern + i, true);
        }
      }
    }
  },
  
  extractHour: function extractHour(pattern, relation, meridiem) {
    let alts = this.getRepAlternatives(pattern,
                                   ["(\\d{1,2}" + this.marker + this.hourlyNumbers + ")"]);
    let res;
    for (let alt in alts) {
      let exp = alts[alt].pattern.replace(this.marker, "|", "g");
      let re = new RegExp(exp, "ig");
      while ((res = re.exec(this.email)) != null) {
        if (res && !this.restrictNumbers(res, this.email) && !this.restrictChars(res, this.email)) {
          res[1] = this.parseNumber(res[1], this.numbers);
          
          if (meridiem == "ante" && res[1] == 12)
            res[1] = res[1] - 12;
          if (meridiem == "post" && res[1] != 12)
            res[1] = res[1] + 12;
          
          if (this.isValidHour(res[1])) {
            let rev = this.prefixSuffixStartEnd(res, relation, this.email);
            this.guess(undefined, undefined, undefined,
                       this.normalizeHour(res[1]), 0,
                       rev.start, rev.end,
                       rev.pattern, rev.relation, pattern, true);
          }
        }
      }
    }
  },
  
  extractHalfHour: function extractHalfHour(pattern, relation, direction) {
    let alts = this.getRepAlternatives(pattern,
                                   ["(\\d{1,2}" + this.marker + this.hourlyNumbers + ")"]);
    let res;
    for (let alt in alts) {
      let exp = alts[alt].pattern.replace(this.marker, "|", "g");
      let re = new RegExp(exp, "ig");
      while ((res = re.exec(this.email)) != null) {
        if (res && !this.restrictNumbers(res, this.email) && !this.restrictChars(res, this.email)) {
          res[1] = this.parseNumber(res[1], this.numbers);
          
          if (direction == "ante")
            if (res[1] == 1)
              res[1] = 12;
            else
              res[1] = res[1] - 1;
          
          if (this.isValidHour(res[1])) {
            let rev = this.prefixSuffixStartEnd(res, relation, this.email);
            this.guess(undefined, undefined, undefined,
                       this.normalizeHour(res[1]), 30,
                       rev.start, rev.end,
                       rev.pattern, rev.relation, pattern, true);
          }
        }
      }
    }
  },
  
  extractHourMinutes: function extractHourMinutes(pattern, relation, meridiem) {
    let alts = this.getRepAlternatives(pattern,
                                   ["(\\d{1,2})", "(\\d{2})"]);
    let res;
    for (let alt in alts) {
      let re = new RegExp(alts[alt].pattern, "ig");
      
      while ((res = re.exec(this.email)) != null) {
        if (res && !this.restrictNumbers(res, this.email) && !this.restrictChars(res, this.email)) {
          res[1] = parseInt(res[1], 10);
          res[2] = parseInt(res[2], 10);
          
          if (meridiem == "ante" && res[1] == 12)
            res[1] = res[1] - 12;
          if (meridiem == "post" && res[1] != 12)
            res[1] = res[1] + 12;
          
          if (this.isValidHour(res[1]) && this.isValidMinute(res[2])) {
            let rev = this.prefixSuffixStartEnd(res, relation, this.email);
            this.guess(undefined, undefined, undefined,
                       this.normalizeHour(res[1]), res[2],
                       rev.start, rev.end,
                       rev.pattern, rev.relation, pattern);
          }
        }
      }
    }
  },
  
  extractTime: function extractTime(pattern, relation, hour, minute) {
    let re = new RegExp(this.getAlternatives(pattern), "ig");
    let res;
    if ((res = re.exec(this.email)) != null) {
      if (!this.restrictChars(res, this.email)) {
        let rev = this.prefixSuffixStartEnd(res, relation, this.email);
        this.guess(undefined, undefined, undefined,
                   hour, minute,
                   rev.start, rev.end,
                   rev.pattern, rev.relation, pattern);
      }
    }
  },
  
  extractDuration: function extractDuration(pattern, unit) {
    let alts = this.getRepAlternatives(pattern, ["(\\d{1,2}" + this.marker + this.dailyNumbers + ")"]);
    let res;
    for (let alt in alts) {
      let exp = alts[alt].pattern.replace(this.marker, "|", "g");
      let re = new RegExp(exp, "ig");
      while ((res = re.exec(this.email)) != null) {
        if (res && !this.restrictNumbers(res, this.email) && !this.restrictChars(res, this.email)) {
          res[1] = this.parseNumber(res[1], this.numbers);
          let guess = {};
          let rev = this.prefixSuffixStartEnd(res, "duration", this.email);
          guess.duration = res[1] * unit;
          guess.start = rev.start;
          guess.end = rev.end;
          guess.str = rev.pattern;
          guess.relation = rev.relation;
          guess.pattern = pattern;
          this.collected.push(guess);
        }
      }
    }
  },
  
  markContained: function markContained() {
    for (let outer = 0; outer < this.collected.length; outer++) {
      for (let inner = 0; inner < this.collected.length; inner++) {
        
        // included but not exactly the same
        if (outer != inner &&
            this.collected[outer].start && this.collected[outer].end &&
            this.collected[inner].start && this.collected[inner].end &&
            this.collected[inner].start >= this.collected[outer].start &&
            this.collected[inner].end <= this.collected[outer].end &&
           !(this.collected[inner].start == this.collected[outer].start &&
              this.collected[inner].end == this.collected[outer].end)) {
            
            this.aConsoleService.logStringMessage(this.collected[outer].str + " found as well, disgarding " + this.collected[inner].str);
            this.collected[inner].relation = "notadatetime";
        }
      }
    }
  },
  
  markSelected: function markSelected(sel, title) {
    if (sel.rangeCount > 0) {
      // mark the ones to not use
      for (let i = 0; i < sel.rangeCount; i++) {
        this.aConsoleService.logStringMessage("Selection " + i + " is " + selection);
        for (let j = 0; j < this.collected.length; j++) {
          let selection = sel.getRangeAt(i).toString();
          
          if (!selection.contains(this.collected[j].str) &&
              !title.contains(this.collected[j].str)
          ) {
            this.collected[j].relation = "notadatetime";
            this.aConsoleService.logStringMessage("Marked " + JSON.stringify(this.collected[j]) + " as notadatetime");
          }
        }
      }
    }
  },
  
  sort: function sort(one, two) {
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
  },
  
  /**
   * Guesses start time from list of guessed datetimes
   * 
   * @param collected list of datetimes extracted by extract()
   * @param isTask    whether start time should be guessed for task or event 
   * @return          datetime object for start time
   */
  guessStart: function guessStart(collected, isTask) {
    let startTimes = collected.filter(function(val) {
        return (val.relation == "start");});
    if (startTimes.length == 0)
      return {};
    else {
      for (let val in startTimes) {
//         dump("Start: " + JSON.stringify(startTimes[val]) + "\n");
        this.aConsoleService.logStringMessage("Start: " + JSON.stringify(startTimes[val]));
      }
      
      var guess = {};
      let withDayInit = startTimes.filter(function(val) {
        return (val.day != undefined && val.start == undefined);});
      // with tasks we don't try to guess start but assume email date
      if (isTask) {
        guess.year = withDayInit[0].year;
        guess.month = withDayInit[0].month;
        guess.day = withDayInit[0].day;
        guess.hour = withDayInit[0].hour;
        guess.minute = withDayInit[0].minute;
        return guess;
      }
      
      let withDay = startTimes.filter(function(val) {
        return (val.day != undefined && val.start != undefined);});
      let withDayNA = withDay.filter(function(val) {
        return (val.ambiguous == undefined);});
      
      let withMinute = startTimes.filter(function(val) {
        return (val.minute != undefined && val.start != undefined);});
      let withMinuteNA = withMinute.filter(function(val) {
        return (val.ambiguous == undefined);});
      let withMinuteInit = startTimes.filter(function(val) {
        return (val.minute != undefined && val.start == undefined);});
      
      if (withMinuteNA.length != 0) {
        guess.hour = withMinuteNA[0].hour;
        guess.minute = withMinuteNA[0].minute;
      } else if (withMinute.length != 0) {
        guess.hour = withMinute[0].hour;
        guess.minute = withMinute[0].minute;
      }
      
      // first use unambiguous guesses
      if (withDayNA.length != 0) {
        guess.year = withDayNA[0].year;
        guess.month = withDayNA[0].month;
        guess.day = withDayNA[0].day;
      // then also ambiguous ones
      } else if (withDay.length != 0) {
        guess.year = withDay[0].year;
        guess.month = withDay[0].month;
        guess.day = withDay[0].day;
      // next possible day considering time
      } else if (guess.hour != undefined &&
        (withDayInit[0].hour > guess.hour ||
          (withDayInit[0].hour == guess.hour && withDayInit[0].minute > guess.minute))) {
        let nextDay = new Date(withDayInit[0].year, withDayInit[0].month - 1, withDayInit[0].day);
        nextDay.setTime(nextDay.getTime() + 60 * 60 * 24 * 1000);
        guess.year = nextDay.getFullYear();
        guess.month = nextDay.getMonth() + 1;
        guess.day = nextDay.getDate();
      // and finally when nothing was found then use initial guess from send time
      } else {
        guess.year = withDayInit[0].year;
        guess.month = withDayInit[0].month;
        guess.day = withDayInit[0].day;
      }
      
      return guess;
    }
  },
  
  /**
   * Guesses end time from list of guessed datetimes relative to start time
   * 
   * @param collected list of datetimes extracted by extract()
   * @param start     start time to consider when guessing
   * @param isTask    whether start time should be guessed for task or event
   * @return          datetime object for end time
   */
  guessEnd: function guessEnd(collected, start, isTask) {
    var guess = {};
    let endTimes = collected.filter(function(val) {
        return (val.relation == "end");});
    let durations = collected.filter(function(val) {
        return (val.relation == "duration");});
    if (endTimes.length == 0 && durations.length == 0)
      return {};
    else {
      for (val in endTimes) {
//         dump("End: " + JSON.stringify(endTimes[val]) + "\n");
        this.aConsoleService.logStringMessage("End: " + JSON.stringify(endTimes[val]));
      }
      
      let withDay = endTimes.filter(function(val) {
        return (val.day != undefined);});
      let withDayNA = withDay.filter(function(val) {
        return (val.ambiguous == undefined);});
      let withMinute = endTimes.filter(function(val) {
        return (val.minute != undefined);});
      let withMinuteNA = withMinute.filter(function(val) {
        return (val.ambiguous == undefined);});
      
      // first set non-ambiguous dates
      let pos = isTask == true ? 0 : withDayNA.length - 1;
      if (withDayNA.length != 0) {
        guess.year = withDayNA[pos].year;
        guess.month = withDayNA[pos].month;
        guess.day = withDayNA[pos].day;
      // then ambiguous dates
      } else if (withDay.length != 0) {
        pos = isTask == true ? 0 : withDay.length - 1;
        guess.year = withDay[pos].year;
        guess.month = withDay[pos].month;
        guess.day = withDay[pos].day;
      }
      
      // then non-ambiguous times
      if (withMinuteNA.length != 0) {
        pos = isTask == true ? 0 : withMinuteNA.length - 1;
        guess.hour = withMinuteNA[pos].hour;
        guess.minute = withMinuteNA[pos].minute;
        if (guess.day == undefined || guess.day == start.day) {
          if (withMinuteNA[pos].hour < start.hour ||
              (withMinuteNA[pos].hour == start.hour &&
              withMinuteNA[pos].minute < start.minute)
          ) {
            let nextDay = new Date(start.year, start.month - 1, start.day);
            nextDay.setTime(nextDay.getTime() + 60 * 60 * 24 * 1000);
            guess.year = nextDay.getFullYear();
            guess.month = nextDay.getMonth() + 1;
            guess.day = nextDay.getDate();
          }
        }
      // and ambiguous times
      } else if (withMinute.length != 0) {
        pos = isTask == true ? 0 : withMinute.length - 1;
        guess.hour = withMinute[pos].hour;
        guess.minute = withMinute[pos].minute;
        if (guess.day == undefined || guess.day == start.day) {
          if (withMinute[pos].hour < start.hour ||
              (withMinute[pos].hour == start.hour &&
              withMinute[pos].minute < start.minute)
          ) {
            let nextDay = new Date(start.year, start.month - 1, start.day);
            nextDay.setTime(nextDay.getTime() + 60 * 60 * 24 * 1000);
            guess.year = nextDay.getFullYear();
            guess.month = nextDay.getMonth() + 1;
            guess.day = nextDay.getDate();
          }
        }
      }
      
      // fill in date when date was guessed
      if (guess.minute != undefined && guess.day == undefined) {
        guess.year = start.year;
        guess.month = start.month;
        guess.day = start.day;
      }
      
      // fill in end from total duration
      if (guess.day == undefined && guess.hour == undefined) {
        let duration = 0;
        
        for (val in durations) {
          duration += durations[val].duration;
//           dump("Dur: " + JSON.stringify(durations[val]) + "\n");
          this.aConsoleService.logStringMessage("Dur: " + JSON.stringify(durations[val]));
        }
        
        if (duration != 0) {
          let startDate = new Date(start.year, start.month - 1, start.day);
          if (start.hour != undefined) {
            startDate.setHours(start.hour);
            startDate.setMinutes(start.minute);
          } else {
            startDate.setHours(0);
            startDate.setMinutes(0);
          }
            
          let endTime = new Date(startDate.getTime() + duration * 60 * 1000);
          guess.year = endTime.getFullYear();
          guess.month = endTime.getMonth() + 1;
          guess.day = endTime.getDate();
          if (!(endTime.getHours() == 0 && endTime.getMinutes() == 0)) {
            guess.hour = endTime.getHours()
            guess.minute = endTime.getMinutes();
          }
        }
      }
      
      // no zero length events/tasks
      if (guess.year == start.year && guess.month == start.month
        && guess.day == start.day && guess.hour == start.hour
        && guess.minute == start.minute) {
          guess.year = undefined;
          guess.month = undefined;
          guess.day = undefined;
          guess.hour = undefined;
          guess.minute = undefined;
      }
      
      if (guess.year != undefined && guess.minute == undefined && isTask) {
          guess.hour = 0;
          guess.minute = 0;
      }
      
      return guess;
    }
  },

  getAlternatives: function getAlternatives(name) {
    let value;
    let def = "abcd";
    try {
      value = this.bundle.GetStringFromName(name);
      if (value.trim() == "") {
        this.aConsoleService.logStringMessage("Pattern not found: " + name);
        return def;
      }
      
      let vals = this.cleanPatterns(value).split("|");
      if (this.overrides[name] != undefined && this.overrides[name]["add"] != undefined) {
        let additions = this.overrides[name]["add"];
        additions = this.cleanPatterns(additions).split("|");
        for (let pattern in additions) {
          vals.push(additions[pattern]);
          this.aConsoleService.logStringMessage("Added " + additions[pattern] + " to " + name + "\n");
        }
      }
      
      if (this.overrides[name] != undefined && this.overrides[name]["remove"] != undefined) {
        let removals = this.overrides[name]["remove"];
        removals = this.cleanPatterns(removals).split("|");
        for (let pattern in removals) {
          let idx = vals.indexOf(removals[pattern]);
          if (idx != -1) {
            vals.splice(idx, 1);
            this.aConsoleService.logStringMessage("Removed " + removals[pattern] + " from " + name + "\n");
          }
        }
      }
      
      vals.sort(function(one, two) {return two.length - one.length;});
      return vals.join("|");
    } catch (ex) {
      this.aConsoleService.logStringMessage("Pattern not found: " + name);
      
      // fake a value to not error out
      return def;
    }
  },

  getRepAlternatives: function getRepAlternatives(name, replaceables) {
    let alts = new Array();
    let patterns = new Array();
    
    try {
      let value = this.bundle.GetStringFromName(name);
      if (value.trim() == "")
        throw "";
      
      let vals = this.cleanPatterns(value).split("|");
      if (this.overrides[name] != undefined && this.overrides[name]["add"] != undefined) {
        let additions = this.overrides[name]["add"];
        additions = this.cleanPatterns(additions).split("|");
        for (let pattern in additions) {
          vals.push(additions[pattern]);
          this.aConsoleService.logStringMessage("Added " + additions[pattern] + " to " + name + "\n");
        }
      }
      
      if (this.overrides[name] != undefined && this.overrides[name]["remove"] != undefined) {
        let removals = this.overrides[name]["remove"];
        removals = this.cleanPatterns(removals).split("|");
        for (let pattern in removals) {
          let idx = vals.indexOf(removals[pattern]);
          if (idx != -1) {
            vals.splice(idx, 1);
            this.aConsoleService.logStringMessage("Removed " + removals[pattern] + " from " + name + "\n");
          }
        }
      }
      
      vals.sort(function(one, two) {return two.length - one.length;});
      for (let val in vals) {
        let pattern = vals[val];
        let cnt = 1;
        for (let replaceable in replaceables) {
            pattern = pattern.replace("%" + cnt + "$S", replaceables[cnt - 1], "g");
            cnt++;
        }
        patterns.push(pattern);
      }
      
      for (let val in vals) {
        let positions = new Array();
        if (replaceables.length == 1)
          positions[1] = 1;
        else
          positions = this.getPositionsFor(vals[val], name, replaceables.length);
        alts[val] = {pattern: patterns[val], positions: positions};
      }
    } catch (ex) {
      this.aConsoleService.logStringMessage("Pattern not found: " + name);
    }
    return alts;
  },

  getPositionsFor: function getPositionsFor(s, name, count) {
    let positions = new Array();
    let re = /\%(\d)\$S/g;
    let match;
    let i = 0;
    while (match = re.exec(s)) {
      i++;
      positions[parseInt(match[1], 10)] = i;
    }
    
    // sanity checking
    for(i = 1; i <= count; i++) {
      if (positions[i] == undefined) {
        dump("Faulty extraction pattern " + name + ", missing parameter %" + i + "$S\n");
        Components.utils.reportError("Faulty extraction pattern " + name + ", missing parameter %" + i + "$S");
      }
    }
    return positions;
  },
  
  cleanPatterns: function cleanPatterns(pattern) {
    // remove whitespace around | if present
    let value = pattern.replace(/\s*\|\s*/g, "|");
    // allow matching for patterns with missing or excessive whitespace
    return value.replace(/\s+/g, "\\s*").sanitize();
  },
  
  isValidYear: function isValidYear(year) {
    return (year >= 2000  && year <= 2050);
  },
  
  isValidMonth: function isValidMonth(month) {
    return (month >= 1 && month <= 12);
  },
  
  isValidDay: function isValidDay(day) {
    return (day >= 1 && day <= 31);
  },
  
  isValidHour: function isValidHour(hour) {
    return (hour >= 0 && hour <= 23);
  },
  
  isValidMinute: function isValidMinute(minute) {
    return (minute >= 0 && minute <= 59);
  },
  
  isPastDate: function isPastDate(date, refDate) {
    // avoid changing original refDate
    let refDate = new Date(refDate.getTime());
    refDate.setHours(0);
    refDate.setMinutes(0);
    refDate.setSeconds(0);
    refDate.setMilliseconds(0);
    let jsDate;
    if (date.day != undefined)
      jsDate = new Date(date.year, date.month - 1, date.day);
    return jsDate < refDate;
  },
  
  normalizeHour: function normalizeHour(hour) {
    if (hour < this.dayStart && hour <= 11)
      return hour + 12;
    else
      return hour;
  },
  
  normalizeYear: function normalizeYear(year) {
    if (year.length == 2)
      return "20" + year;
    else
      return year;
  },
  
  restrictNumbers: function restrictNumbers(res, email) {
    let pattern = email.substring(res.index, res.index + res[0].length);
    let before = email.charAt(res.index - 1);
    let after = email.charAt(res.index + res[0].length);
    let result = (/\d/.exec(before) && /\d/.exec(pattern.charAt(0))) ||
              (/\d/.exec(pattern.charAt(pattern.length - 1)) && /\d/.exec(after));
    return result != null;
  },
  
  restrictChars: function restrictChars(res, email) {
    let alphabet = this.getAlternatives("alphabet");
    // for languages without regular alphabet surrounding characters are ignored
    if (alphabet == "")
      return false;
    
    let pattern = email.substring(res.index, res.index + res[0].length);
    let before = email.charAt(res.index - 1);
    let after = email.charAt(res.index + res[0].length);
    
    let w = new RegExp("[" + alphabet + "]");
    let result = (w.exec(before) && w.exec(pattern.charAt(0))) ||
                 (w.exec(pattern.charAt(pattern.length - 1)) && w.exec(after));
    return result != null;
  },
  
  prefixSuffixStartEnd: function prefixSuffixStart(res, relation, email) {
    let pattern = email.substring(res.index, res.index + res[0].length);
    let prev = email.substring(0, res.index);
    let next = email.substring(res.index + res[0].length);
    let prefixSuffix = {start: res.index, end: res.index + res[0].length, pattern: pattern, relation: relation};
    let ch = "\\s*";
    let res;
    
    let re = new RegExp("(" + this.getAlternatives("end.prefix") + ")" + ch + "$", "ig");
    if ((res = re.exec(prev)) != null) {
      prefixSuffix.relation = "end";
      prefixSuffix.start = res.index;
      prefixSuffix.pattern = res[0] + pattern;
    }
    
    re = new RegExp("^" + ch + "(" + this.getAlternatives("end.suffix") + ")", "ig");
    if ((res = re.exec(next)) != null) {
      prefixSuffix.relation = "end";
      prefixSuffix.end = prefixSuffix.end + res[0].length;
      prefixSuffix.pattern = pattern + res[0];
    }
    
    re = new RegExp("(" + this.getAlternatives("start.prefix") + ")" + ch + "$", "ig");
    if ((res = re.exec(prev)) != null) {
      prefixSuffix.relation = "start";
      prefixSuffix.start = res.index;
      prefixSuffix.pattern = res[0] + pattern;
    }
    
    re = new RegExp("^" + ch + "(" + this.getAlternatives("start.suffix") + ")", "ig");
    if ((res = re.exec(next)) != null) {
      prefixSuffix.relation = "start";
      prefixSuffix.end = prefixSuffix.end + res[0].length;
      prefixSuffix.pattern = pattern + res[0];
    }
    
    re = new RegExp("\\s(" + this.getAlternatives("no.datetime.prefix") + ")" + ch + "$", "ig");

    if ((res = re.exec(prev)) != null) {
      prefixSuffix.relation = "notadatetime";
    }
    
    re = new RegExp("^" + ch + "(" + this.getAlternatives("no.datetime.suffix") + ")", "ig");
    if ((res = re.exec(next)) != null) {
      prefixSuffix.relation = "notadatetime";
    }
    
    return prefixSuffix;
  },
    
  parseNumber: function parseNumber(number, numbers) {
    let r = parseInt(number, 10);
    if (isNaN(r)) {
      for (let i = 0; i <= 31; i++) {
        let ns = numbers[i].split("|");
        if (ns.indexOf(number.toLowerCase() != -1)) {
          return i;
        }
      }
      return -1;
    } else {
      return r;
    }
  },
  
  guess: function guess(year, month, day, hour, minute, start, end, str,
                        relation, pattern, ambiguous) {
    let guess = {year: year, month: month, day: day,
                hour: hour, minute: minute,
                start: start, end: end,
                str: str, relation: relation, pattern: pattern, ambiguous: ambiguous};
    // past dates are not used for final event but are kept for containment checks
    if (this.isPastDate(guess, this.now))
      guess.relation = "notadatetime";
    this.collected.push(guess);
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
