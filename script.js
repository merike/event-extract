/* Experiment on how far you can get with simple regular expressions
 * all times best when guessing one or two (where appropriate) dates and times per event
   correct bits  %    correct events  %   set
   575/610     96%    50/61         82%   enronmeetings
   546/600     91%    35/60         58%   mozilla.dev.planning sept set
   516/600     86%    34/60         57%   private et set
   
  * latest when guessing one or two (where appropriate) dates and times per event
   correct bits  %    correct events  %   set
   575/610     94%    50/61         82%   enronmeetings
   515/600     86%    31/60         52%   mozilla.dev.planning sept set
   514/600     86%    34/60         57%   private et set
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
let baseUrl = "file:/media/Meedia/tty/lt/event-extract/patterns/extract_LOCALE.properties";

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
  var extr = new Extractor(baseUrl, locale);
  var time1 = (new Date()).getTime();
  var refDate = findNow(info.contents);
  extr.extract(null, info.contents, refDate);
  var startGuess = {};
  var endGuess = {};
  if (expected.to != "task") {
    startGuess = extr.guessStart();
    endGuess = extr.guessEnd(startGuess);
  } else {
    startGuess = extr.guessStart(true);
    endGuess = extr.guessEnd(startGuess, true);
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
  now.setDate(1); // else some guesses at the end of month come out wrong
  
  // use date header
  var re = /^Date:\s\w{3},\s+(\d{1,2})\s(\w{3})\s(\d{4})\s(\d{2}):(\d{1,2})/m;
  var res = re.exec(email);
  
  now.setFullYear(parseInt(res[3], 10));
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
  now.setDate(parseInt(res[1], 10));
  now.setHours(parseInt(res[4], 10));
  now.setMinutes(parseInt(res[5], 10));
  
  return now;
}

function compare(correct, guessed, guessedEnd) {
  let r = wrSum;
  
  if (correct.year === guessed.year ||
      correct.year === undefined && guessed.year === null) {
    corSum++;
  } else {
    dump(correct.year + " S " + guessed.year + " year\n");
    wrSum++;
  }
  
  if (correct.month === guessed.month ||
      correct.month === undefined && guessed.month === null) {
    corSum++;
  } else {
    dump(correct.month + " S " + guessed.month + " month\n");
    wrSum++;
  }
  
  if (correct.day === guessed.day ||
      correct.day === undefined && guessed.day === null) {
    corSum++;
  } else {
    dump(correct.day + " S " + guessed.day + " day\n");
    wrSum++;
  }
  
  if (correct.hour === guessed.hour ||
      correct.hour === undefined && guessed.hour === null
  ) {
    corSum++;
  } else {
    dump(correct.hour + " S " + guessed.hour + " hour\n");
    wrSum++;
  }
  
  if (correct.minute === guessed.minute ||
      correct.minute ===  undefined && guessed.minute === null
  ) {
    corSum++;
  } else {
    dump(correct.minute + " S " + guessed.minute + " minute\n");
    wrSum++;
  }
  
  if (correct.year2 === guessedEnd.year ||
      correct.year2 === undefined && guessedEnd.year === null
  ) {
    corSum++;
  } else {
    dump(correct.year2 + " E " + guessedEnd.year + " year\n");
    wrSum++;
  }
  
  if (correct.month2 === guessedEnd.month ||
      correct.month2 === undefined && guessedEnd.month === null
  ) {
    corSum++;
  } else {
    dump(correct.month2 + " E " + guessedEnd.month + " month\n");
    wrSum++;
  }
  
  if (correct.day2 === guessedEnd.day ||
      correct.day2 === undefined && guessedEnd.day === null
  ) {
    corSum++;
  } else {
    dump(correct.day2 + " E " + guessedEnd.day + " day\n");
    wrSum++;
  }
  
  if (correct.hour2 === guessedEnd.hour ||
      correct.hour2 === undefined && guessedEnd.hour === null
  ) {
    corSum++;
  } else {
    dump(correct.hour2 + " E " + guessedEnd.hour + " hour\n");
    wrSum++;
  }
  
  if (correct.minute2 === guessedEnd.minute ||
      correct.minute2 === undefined && guessedEnd.minute === null
  ) {
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
