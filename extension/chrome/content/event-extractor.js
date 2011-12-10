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

Components.utils.import("resource://event-extract/modules/extract.jsm");

var extractFromEmail = function extractFromEmail(isEvent) {
  let aConsoleService = Components.classes["@mozilla.org/consoleservice;1"].
                        getService(Components.interfaces.nsIConsoleService);
  
  let message = gFolderDisplay.selectedMessage;
  let messenger = Components.classes["@mozilla.org/messenger;1"]
                            .createInstance(Components.interfaces.nsIMessenger);
  let listener = Components.classes["@mozilla.org/network/sync-stream-listener;1"]
                          .createInstance(Components.interfaces.nsISyncStreamListener);
  let uri = message.folder.getUriForMsg(message);
  messenger.messageServiceFromURI(uri)
          .streamMessage(uri, listener, null, null, false, "");
  let folder = message.folder;
  let content = message.mime2DecodedSubject + "\r\n" +
                folder.getMsgTextFromStream(listener.inputStream,
                                            message.Charset,
                                            65536,
                                            32768,
                                            false,
                                            true,
                                            { });
  aConsoleService.logStringMessage("Original content: \n" + content);
  let date = new Date(message.date/1000);
  
  let locale = getPrefSafe("general.useragent.locale", "en-US");
  let baseUrl = "chrome://event-extract/content/locale/";
  extractor.setBundle(baseUrl, locale);
  let collected = extractor.extract(content, date);
  let guessed = extractor.guessStart(collected);
  let endGuess = extractor.guessEnd(collected, guessed);
  let allDay = (guessed.hour == undefined || guessed.minute == undefined) &&
               isEvent;
  
  var item;
  if (isEvent) {
    item = createEvent();
  } else {
    item = createTodo();
  }
  item.title = message.mime2DecodedSubject;
  
  item.calendar = getSelectedCalendar();
  item.setProperty("DESCRIPTION", content);
  cal.setDefaultStartEndHour(item);
  
  if (isEvent) {
    if (guessed.year)
      item.startDate.year = guessed.year;
    if (guessed.month)
      item.startDate.month = guessed.month - 1;
    if (guessed.day)
      item.startDate.day = guessed.day;
    if (guessed.hour)
      item.startDate.hour = guessed.hour;
    if (guessed.minute)
      item.startDate.minute = guessed.minute;
    
    item.endDate = item.startDate.clone();
    item.endDate.minute += cal.getPrefSafe("calendar.event.defaultlength", 60);
    
    if (endGuess.year)
      item.endDate.year = endGuess.year;
    if (endGuess.month)
      item.endDate.month = endGuess.month - 1;
    if (endGuess.day) {
      item.endDate.day = endGuess.day;
      if (allDay)
        item.endDate.day++;
    }
    if (endGuess.hour)
      item.endDate.hour = endGuess.hour;
    if (endGuess.minute)
      item.endDate.minute = endGuess.minute;
  } else {
    let dtz = cal.calendarDefaultTimezone();
    let dueDate = new Date();
    // set default
    dueDate.setHours(0);
    dueDate.setMinutes(0);
    dueDate.setSeconds(0);
    
    if (guessed.year != undefined)
      dueDate.setYear(endGuess.year);
    if (guessed.month  != undefined)
      dueDate.setMonth(endGuess.month - 1);
    if (guessed.day != undefined)
      dueDate.setDate(endGuess.day);
    if (guessed.hour != undefined)
      dueDate.setHours(endGuess.hour);
    if (guessed.minute != undefined)
      dueDate.setMinutes(endGuess.minute);
    
    setItemProperty(item, "entryDate", cal.jsDateToDateTime(date, dtz));
    setItemProperty(item, "dueDate", cal.jsDateToDateTime(dueDate, dtz));
  }
  
  // if time not guessed set allday for events
  if (allDay)
    createEventWithDialog(null, null, null, null, item, true);
  else
    createEventWithDialog(null, null, null, null, item);
}
