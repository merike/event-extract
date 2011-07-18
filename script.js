/* Experiment on how far you can get with simple regular expressions
   correct bits  %    correct events  %   set
   111/120      93%   16/24           67% test set
   186/205      91%   26/41           63% train/bunch-1 set
   111/150      74%   12/30           40% private et set
 */

var corSum = 0;
var wrSum = 0;
var corEvents = 0;
var wrEvents = 0;

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
  extractor.setLocale(arguments[1]);

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
  var now = extractor.findNow(info.contents);
  var guess = extractor.extract(info.contents, now);
  compare(expected, guess);
  dump("\n---------------------------------------------------------\n");
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

function compare(correct, guessed) {
  let r = wrSum;
  
  if (correct.year === guessed.year) {
//     dump("correct year\n");
    corSum++;
  } else {
    dump(correct.year + " " + guessed.year + " year\n");
    wrSum++;
  }
  
  if (correct.month === guessed.month) {
//     dump("correct month\n");
    corSum++;
  } else {
    dump(correct.month + " " + guessed.month + " month\n");
    wrSum++;
  }
  
  if (correct.day === guessed.day) {
//     dump("correct day\n");
    corSum++;
  } else {
    dump(correct.day + " " + guessed.day + " day\n");
    wrSum++;
  }
  
  if (correct.hour === guessed.hour) {
//     dump("correct hour\n");
    corSum++;
  } else {
    dump(correct.hour + " " + guessed.hour + " hour\n");
    wrSum++;
  }
  
  if (correct.minute === guessed.minute) {
//     dump("correct minute\n");
    corSum++;
  } else {
    dump(correct.minute + " " + guessed.minute + " minute\n");
    wrSum++;
  }
  
  if (r === wrSum) {
    corEvents++;
  } else {
    wrEvents++;
  }
}
