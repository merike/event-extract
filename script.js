/* Experiment on how far you can get with simple regular expressions
 * all times best when guessing one date and time per event
   correct bits  %    correct events  %   set
   111/120     93%    16/24         67%   test set
   189/205     92%    28/41         68%   train/bunch-1 set
   115/150     77%    18/30         60%   private et set
   
 * all times best when guessing one or two (where appropriate) dates and times per event
   correct bits  %    correct events  %   set
   197/240     82%    11/24         46%   test set
   364/410     89%    25/41         60%   train/bunch-1 set
   363/420     86%    25/42         60%   mozilla.dev.planning sept set
   
   257/300     86%    15/30         50%   private et set
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
let baseUrl = "file:/media/Meedia/tty/lt/event-extract/";

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
  extractor.setBundle(baseUrl, locale);
  var refDate = extractor.findNow(info.contents);
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
    endGuess = extractor.guessEnd(collected, startGuess);
  }
  compare(expected, startGuess, endGuess);
  dump("---------------------------------------------------------\n");
}

dump("total: " + corSum + "/" + (corSum + wrSum) + "\n");
dump("total events: " + corEvents + "/" + (corEvents + wrEvents) + "\n");

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

function compare(correct, guessed, guessedEnd) {
  let r = wrSum;
  
  if (correct.year === guessed.year) {
//     dump("correct year\n");
    corSum++;
  } else {
    dump(correct.year + " S " + guessed.year + " year\n");
    wrSum++;
  }
  
  if (correct.month === guessed.month) {
//     dump("correct month\n");
    corSum++;
  } else {
    dump(correct.month + " S " + guessed.month + " month\n");
    wrSum++;
  }
  
  if (correct.day === guessed.day) {
//     dump("correct day\n");
    corSum++;
  } else {
    dump(correct.day + " S " + guessed.day + " day\n");
    wrSum++;
  }
  
  if (correct.hour === guessed.hour) {
//     dump("correct hour\n");
    corSum++;
  } else {
    dump(correct.hour + " S " + guessed.hour + " hour\n");
    wrSum++;
  }
  
  if (correct.minute === guessed.minute) {
//     dump("correct minute\n");
    corSum++;
  } else {
    dump(correct.minute + " S " + guessed.minute + " minute\n");
    wrSum++;
  }
  
  if (correct.year2 === guessedEnd.year) {
//     dump("correct year\n");
    corSum++;
  } else {
    dump(correct.year2 + " E " + guessedEnd.year + " year\n");
    wrSum++;
  }
  
  if (correct.month2 === guessedEnd.month) {
//     dump("correct month\n");
    corSum++;
  } else {
    dump(correct.month2 + " E " + guessedEnd.month + " month\n");
    wrSum++;
  }
  
  if (correct.day2 === guessedEnd.day) {
//     dump("correct day\n");
    corSum++;
  } else {
    dump(correct.day2 + " E " + guessedEnd.day + " day\n");
    wrSum++;
  }
  
  if (correct.hour2 === guessedEnd.hour) {
//     dump("correct hour\n");
    corSum++;
  } else {
    dump(correct.hour2 + " E " + guessedEnd.hour + " hour\n");
    wrSum++;
  }
  
  if (correct.minute2 === guessedEnd.minute) {
//     dump("correct minute\n");
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
