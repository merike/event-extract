/* Experiment on how far you can get with simple regular expressions
   94/120 apparently
 */

var corSum = 0;
var wrSum = 0;

var file = Components.classes["@mozilla.org/file/local;1"]
   .createInstance(Components.interfaces.nsILocalFile);
var fileCor = Components.classes["@mozilla.org/file/local;1"]
   .createInstance(Components.interfaces.nsILocalFile);

// expecting mails in folder arguments[0] (full path with ending slash)
// answers in folder arguments[0] + "_cor"
file.initWithPath(arguments[0]);
fileCor.initWithPath(arguments[0] + "../" + file.leafName + "_cor");

var mails = file.directoryEntries;
var ans = fileCor.directoryEntries;
var array = [];
while (mails.hasMoreElements()) {
  var file = mails.getNext();
  var corFile = ans.getNext();
  var info = readFile(file);
  var answer = readFile(corFile);
  dump(info.filename + " " + answer.filename + "\n");
  var expected = JSON.parse(answer.contents);
  var now = findNow(info.contents);
  var guess = extract(info.contents, now);
  compare(expected, guess);
  dump("\n---------------------------------------------------------\n");
}

dump("total: " + corSum + "/" + (corSum + wrSum) + "\n");

function readFile(nsiFile) {
  var info = {};
 
  nsiFile.QueryInterface(Components.interfaces.nsIFile);
  info.filename = nsiFile.leafName;
  
  info.contents = "";
  var fstream = Components.classes["@mozilla.org/network/file-input-stream;1"]
                          .createInstance(Components.interfaces.nsIFileInputStream);
  var cstream = Components.classes["@mozilla.org/intl/converter-input-stream;1"]
                          .createInstance(Components.interfaces.nsIConverterInputStream);
  fstream.init(nsiFile, -1, 0, 0);
  cstream.init(fstream, "UTF-8", 0, 0);
 
  let (str = {}) {
    cstream.readString(-1, str);
    info.contents = str.value;
  }
  
  cstream.close();
  return info;
}

function findNow(email) {
  var now = {};
  
  // use date header
  var re = /^Date:\s\w{3},\s(\d{1,2})\s(\w{3})\s(\d{4})\s(\d{2}):(\d{2})/m;
  var res = re.exec(email);

  now.day = parseInt(res[1]);
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
  now.year = parseInt(res[3]);
  now.hour = parseInt(res[4]);
  now.minute = parseInt(res[5]);
  
  return now;
}

function extract(email, now) {
  guess = now;
  // remove Date: and Sent: lines
  email = email.replace(/^Date:.+$/m, "");
  email = email.replace(/^Sent:.+$/m, "");
  
  // from less specific to more specific
  
  if (/tomorrow/.exec(email)) {
    guess.day++;
  }
  
  // day only
  var dayRe = /(\d{1,2}(st|nd|rd|th))/;
  res = dayRe.exec(email);
  if (res) {
//     dump(res[0] + "\n");
    if (res[1]) {
      res[1] = parseInt(res[1]);
      guess.day = res[1];
    }
  }
  
  // time only
  var timeRe2 = /(\d{1,2})am/;
  res = timeRe2.exec(email);
  if (res) {
//     dump(res[0] + "\n");
    if (res[1]) {
      res[1] = parseInt(res[1]);
      guess.hour = res[1];
      guess.minute = 0;
    }
  }
  
  var timeRe3 = /(\d{1,2})pm/;
  res = timeRe3.exec(email);
  if (res) {
//     dump(res[0] + "\n");
    if (res[1]) {
      res[1] = parseInt(res[1]);
      guess.hour = res[1] + 12;
      guess.minute = 0;
    }
  }
  
  // duration
  var durRe = /(\d{1,2})\s?-\s?(\d{1,2})/
  res = durRe.exec(email);
  if (res) {
//     dump(res[0] + "\n");
    if (res[1]) {
      res[1] = parseInt(res[1]);
      if (res[1] < 8) {
        guess.hour = res[1] + 12;
      } else {
        guess.hour = res[1];
      }
      guess.minute = 0;
    }
  }
  
  // hour:minutes
  var timeRe = /(\d{1,2}):(\d{2})/;
  res = timeRe.exec(email);
  if (res) {
    if (res[1]) {
//       dump(res[0] + "\n");
      res[1] = parseInt(res[1]);
      // unlikely meeting time
      if (res[1] < 8) {
        guess.hour = res[1] + 12;
      } else {
        guess.hour = res[1];
      }
    }
    if (res[2]) {
      res[2] = parseInt(res[2]);
      guess.minute = res[2];
    }
  }
  
  // month with day
  var dateRe = /(January|February|March|May|June|July|August|September|October|November|December)\s(\d{1,2})/;
  res = dateRe.exec(email);
  if (res) {
//     dump(res[0] + "\n");
    if (res[1]) {
      switch (res[1]) {
        case "January":
          guess.month = 1;
          break;
        case "February":
          guess.month = 2;
          break;
        case "March":
          guess.month = 3;
          break;
        case "April":
          guess.month = 4;
          break;
        case "May":
          guess.month = 5;
          break;
        case "June":
          guess.month = 6;
          break;
        case "July":
          guess.month = 7;
          break;
        case "August":
          guess.month = 8;
          break;
        case "September":
          guess.month = 9;
          break;
        case "October":
          guess.month = 10;
          break;
        case "November":
          guess.month = 11;
          break;
        case "December":
          guess.month = 12;
          break;
      }
    }
    if (res[2]) {
      res[2] = parseInt(res[2]);
      guess.day = res[2];
    }
  }
  
  var dateRe2 = /(Jan\.|Feb\.|Mar\.|May|Jun\.|Jul\.|Aug\.|Sept\.|Oct\.|Nov\.|Dec\.)\s(\d{1,2})/;
  res = dateRe2.exec(email);
  if (res) {
//     dump(res[0] + "\n");
    if (res[1]) {
      switch (res[1]) {
        case "Jan.":
          guess.month = 1;
          break;
        case "Feb.":
          guess.month = 2;
          break;
        case "Mar.":
          guess.month = 3;
          break;
        case "Apr.":
          guess.month = 4;
          break;
        case "May":
          guess.month = 5;
          break;
        case "Jun.":
          guess.month = 6;
          break;
        case "Jul.":
          guess.month = 7;
          break;
        case "Aug.":
          guess.month = 8;
          break;
        case "Sept.":
          guess.month = 9;
          break;
        case "Oct.":
          guess.month = 10;
          break;
        case "Nov.":
          guess.month = 11;
          break;
        case "Dec.":
          guess.month = 12;
          break;
      }
    }
    if (res[2]) {
      res[2] = parseInt(res[2]);
      guess.day = res[2];
    }
  }
  
  // date with year
  var dateRe3 = /(\d{1,2})\s(Jan|Feb|Mar|May|Jun|Jul|Aug|Sept|Oct|Nov|Dec)\.?\s(\d{4})/;
  res = dateRe3.exec(email);
  if (res) {
//     dump(res[0] + "\n");
    if (res[1]) {
      res[1] = parseInt(res[1]);
      guess.day = res[1];
    }
    if (res[2]) {
      switch (res[2]) {
        case "Jan":
          guess.month = 1;
          break;
        case "Feb":
          guess.month = 2;
          break;
        case "Mar":
          guess.month = 3;
          break;
        case "Apr":
          guess.month = 4;
          break;
        case "May":
          guess.month = 5;
          break;
        case "Jun":
          guess.month = 6;
          break;
        case "Jul":
          guess.month = 7;
          break;
        case "Aug":
          guess.month = 8;
          break;
        case "Sept":
          guess.month = 9;
          break;
        case "Oct":
          guess.month = 10;
          break;
        case "Nov":
          guess.month = 11;
          break;
        case "Dec":
          guess.month = 12;
          break;
      }
    }
    if (res[3]) {
      res[3] = parseInt(res[3]);
      guess.year = res[3];
    }
  }
  
  return guess;
}

function compare(correct, guessed) {
  if (correct.year == guessed.year) {
//     dump("correct year\n");
    corSum++;
  } else {
    dump(correct.year + " " + guessed.year + " year\n");
    wrSum++;
  }
  
  if (correct.month == guessed.month) {
//     dump("correct month\n");
    corSum++;
  } else {
    dump(correct.month + " " + guessed.month + " month\n");
    wrSum++;
  }
  
  if (correct.day == guessed.day) {
//     dump("correct day\n");
    corSum++;
  } else {
    dump(correct.day + " " + guessed.day + " day\n");
    wrSum++;
  }
  
  if (correct.hour == guessed.hour) {
//     dump("correct hour\n");
    corSum++;
  } else {
    dump(correct.hour + " " + guessed.hour + " hour\n");
    wrSum++;
  }
  
  if (correct.minute == guessed.minute) {
//     dump("correct minute\n");
    corSum++;
  } else {
    dump(correct.minute + " " + guessed.minute + " minute\n");
    wrSum++;
  }
}
