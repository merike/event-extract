/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://event-extract/modules/extract.jsm");

var extract = {
  extractFromEmail: function extractFromEmail(isEvent) {
    let aConsoleService = Components.classes["@mozilla.org/consoleservice;1"].
                          getService(Components.interfaces.nsIConsoleService);
    
    // TODO handle multiple selected messages, lightning itself does not though
    let message = gFolderDisplay.selectedMessage;
    let messenger = Components.classes["@mozilla.org/messenger;1"]
                              .createInstance(Components.interfaces.nsIMessenger);
    let listener = Components.classes["@mozilla.org/network/sync-stream-listener;1"]
                            .createInstance(Components.interfaces.nsISyncStreamListener);
    let uri = message.folder.getUriForMsg(message);
    messenger.messageServiceFromURI(uri)
            .streamMessage(uri, listener, null, null, false, "");
    let folder = message.folder;
    let title = message.mime2DecodedSubject;
    let content = folder.getMsgTextFromStream(listener.inputStream,
                                              message.Charset,
                                              65536,
                                              32768,
                                              false,
                                              true,
                                              { });
    aConsoleService.logStringMessage("Original email content: \n" + title + "\r\n" + content);
    let date = new Date(message.date/1000);
    let time = (new Date()).getTime();
    
    let locale = cal.getPrefSafe("general.useragent.locale", "en-US");
    let baseUrl = "chrome://event-extract/content/locale/";
    let dayStart = cal.getPrefSafe("calendar.view.daystarthour", 6);
    extractor.setBundle(baseUrl, locale);
    let sel = GetMessagePaneFrame().getSelection();
    let collected = extractor.extract(title + "\r\n" + content, date, dayStart, sel, title);
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
    cal.alarms.setDefaultValues(item);
    
    if (isEvent) {
      if (guessed.year != undefined)
        item.startDate.year = guessed.year;
      if (guessed.month != undefined)
        item.startDate.month = guessed.month - 1;
      if (guessed.day != undefined)
        item.startDate.day = guessed.day;
      if (guessed.hour != undefined)
        item.startDate.hour = guessed.hour;
      if (guessed.minute != undefined)
        item.startDate.minute = guessed.minute;
      
      item.endDate = item.startDate.clone();
      item.endDate.minute += cal.getPrefSafe("calendar.event.defaultlength", 60);
      
      if (endGuess.year != undefined)
        item.endDate.year = endGuess.year;
      if (endGuess.month != undefined)
        item.endDate.month = endGuess.month - 1;
      if (endGuess.day != undefined) {
        item.endDate.day = endGuess.day;
        if (allDay)
          item.endDate.day++;
      }
      if (endGuess.hour != undefined)
        item.endDate.hour = endGuess.hour;
      if (endGuess.minute != undefined)
        item.endDate.minute = endGuess.minute;
    } else {
      let dtz = cal.calendarDefaultTimezone();
      let dueDate = new Date();
      // set default
      dueDate.setHours(0);
      dueDate.setMinutes(0);
      dueDate.setSeconds(0);
      
      if (endGuess.year != undefined)
        dueDate.setYear(endGuess.year);
      if (endGuess.month  != undefined)
        dueDate.setMonth(endGuess.month - 1);
      if (endGuess.day != undefined)
        dueDate.setDate(endGuess.day);
      if (endGuess.hour != undefined)
        dueDate.setHours(endGuess.hour);
      if (endGuess.minute != undefined)
        dueDate.setMinutes(endGuess.minute);
      
      setItemProperty(item, "entryDate", cal.jsDateToDateTime(date, dtz));
      setItemProperty(item, "dueDate", cal.jsDateToDateTime(dueDate, dtz));
    }
    
    let timeSpent = (new Date()).getTime() - time;
    aConsoleService.logStringMessage("Total time spent for conversion (including loading of dictionaries): " + timeSpent + "ms");
    
    // if time not guessed set allday for events
    if (allDay)
      createEventWithDialog(null, null, null, null, item, true);
    else
      createEventWithDialog(null, null, null, null, item);
  },
  
  addListeners: function addListeners() {
    if (window.top.document.location == "chrome://messenger/content/messenger.xul") {
      // cover initial load and folder change
      let folderTree = document.getElementById("folderTree");
      folderTree.addEventListener("select", this.setButtons, false);
      
      // cover selection change in a folder
      let msgTree = window.top.GetThreadTree();
      msgTree.addEventListener("select", this.setButtons, false);
    }
  },

  setButtons: function setButtons () {
    let button = document.getElementById("extractEventButton");
    if (button) {
      if (gFolderDisplay.selectedCount == 0) {
        button.disabled = true;
      } else {
        button.disabled = false;
      }
    }
  }
}

extract.addListeners();