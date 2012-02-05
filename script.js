/* Experiment on how far you can get with simple regular expressions
 * all times best when guessing one or two (where appropriate) dates and times per event
   correct bits  %    correct events  %   set
   530/610     87%    39/61         64%   enronmeetings
   546/600     91%    35/60         58%   mozilla.dev.planning sept set
   511/600     85%    30/60         50%   private et set
 */

var corSum = 0;
var wrSum = 0;
var corEvents = 0;
var wrEvents = 0;

var locale = "en-US";

var file = Components.classes["@mozilla.org/file/local;1"]
   .createInstance(Components.interfaces.nsILocalFile);
var fileCor = Components.classes["@mozilla.org/file/local;1"]
   .createInstance(Components.interfaces.nsILocalFile);

Components.utils.import("file:/media/Meedia/tty/lt/event-extract/extract.jsm");

// expecting mails in folder arguments[0] (full path with ending slash)
// answers in folder arguments[0] + "_cor"
file.initWithPath(arguments[0]);
fileCor.initWithPath(arguments[0] + "../" + file.leafName + "_cor");

if (arguments[1])
  locale = arguments[1];
let baseUrl = "file:/media/Meedia/tty/lt/event-extract/patterns/";

var mails = file.directoryEntries;
var ans = fileCor.directoryEntries;
var array = [];

var minTime = 99999;
var maxTime = 0;
var total = 0;
while (mails.hasMoreElements()) {
  var file = mails.getNext();
  var corFile = ans.getNext();
  var info = readFile(file);
  var answer = readFile(corFile);
  dump(info.filename + " " + answer.filename + "\n");
  var expected = JSON.parse(answer.contents);
  extractor.setBundle(baseUrl, locale);
  var time1 = (new Date()).getTime();
  var refDate = findNow(info.contents);
  var collected = extractor.extract(info.contents, refDate);
  var startGuess = {};
  var endGuess = {};
  if (expected.to != "task") {
    startGuess = extractor.guessStart(collected);
    endGuess = extractor.guessEnd(collected, startGuess);
  } else {
    startGuess.year = refDate.getFullYear();
    startGuess.month = refDate.getMonth() + 1;
    startGuess.day = refDate.getDate();
    startGuess.hour = refDate.getHours();
    startGuess.minute = refDate.getMinutes();
    endGuess = extractor.guessEnd(collected, startGuess, true);
    if (endGuess.hour == undefined) {
      endGuess.hour = 0;
      endGuess.minute = 0;
    }
  }
  
  var time2 = (new Date()).getTime();
  var time = time2 - time1;
  total += time;
  
  if (time < minTime)
    minTime = time;
  if (time > maxTime)
    maxTime = time;
  
  compare(expected, startGuess, endGuess);
  dump("---------------------------------------------------------\n");
}

dump("total: " + corSum + "/" + (corSum + wrSum) + "\n");
dump("total events: " + corEvents + "/" + (corEvents + wrEvents) + "\n");
var avg = total * 1.0 / (corEvents + wrEvents);
dump("total: " + total + " minTime: " + minTime + " maxTime: " + maxTime + " avg: " + avg + "\n");

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
    case "Nov":
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
}

function compare(correct, guessed, guessedEnd) {
  let r = wrSum;
  
  if (correct.year === guessed.year) {
    corSum++;
  } else {
    dump(correct.year + " S " + guessed.year + " year\n");
    wrSum++;
  }
  
  if (correct.month === guessed.month) {
    corSum++;
  } else {
    dump(correct.month + " S " + guessed.month + " month\n");
    wrSum++;
  }
  
  if (correct.day === guessed.day) {
    corSum++;
  } else {
    dump(correct.day + " S " + guessed.day + " day\n");
    wrSum++;
  }
  
  if (correct.hour === guessed.hour) {
    corSum++;
  } else {
    dump(correct.hour + " S " + guessed.hour + " hour\n");
    wrSum++;
  }
  
  if (correct.minute === guessed.minute) {
    corSum++;
  } else {
    dump(correct.minute + " S " + guessed.minute + " minute\n");
    wrSum++;
  }
  
  if (correct.year2 === guessedEnd.year) {
    corSum++;
  } else {
    dump(correct.year2 + " E " + guessedEnd.year + " year\n");
    wrSum++;
  }
  
  if (correct.month2 === guessedEnd.month) {
    corSum++;
  } else {
    dump(correct.month2 + " E " + guessedEnd.month + " month\n");
    wrSum++;
  }
  
  if (correct.day2 === guessedEnd.day) {
    corSum++;
  } else {
    dump(correct.day2 + " E " + guessedEnd.day + " day\n");
    wrSum++;
  }
  
  if (correct.hour2 === guessedEnd.hour) {
    corSum++;
  } else {
    dump(correct.hour2 + " E " + guessedEnd.hour + " hour\n");
    wrSum++;
  }
  
  if (correct.minute2 === guessedEnd.minute) {
    corSum++;
  } else {
    dump(correct.minute2 + " E " + guessedEnd.minute + " minute\n");
    wrSum++;
  }
  
  if (r === wrSum) {
    corEvents++;
  } else {
    wrEvents++;
  }
}
