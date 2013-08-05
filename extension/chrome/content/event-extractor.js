/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

//Components.utils.import("resource://event-extract/modules/extract.jsm");
Components.utils.import("resource://calendar/modules/calExtract.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");

var extract = {
  OnShowLocaleMenu: function OnShowLocaleMenu(target) {
    let localeList = document.getElementById(target.id);

    let uri =  Services.io.getProtocolHandler("resource")
                        .QueryInterface(Components.interfaces.nsIResProtocolHandler)
                        .getSubstitution("calendar");
    let file = Services.io.getProtocolHandler("file")
                        .QueryInterface(Components.interfaces.nsIFileProtocolHandler)
                        .getFileFromURLSpec(uri.spec);
    file.append("chrome");
    let entries = file.directoryEntries;
    let service = Components.classes["@mozilla.org/intl/stringbundle;1"]
                            .getService(Components.interfaces.nsIStringBundleService);
    // TODO use window bundle
    let bundle = service.createBundle("chrome://global/locale/languageNames.properties");
    let aConsoleService = Components.classes["@mozilla.org/consoleservice;1"]
                                    .getService(Components.interfaces.nsIConsoleService);

    let langs = new Array();
    while (entries.hasMoreElements()) {
      let entry = entries.getNext();
      entry.QueryInterface(Components.interfaces.nsIFile);
      let localeJar = /^calendar-((..)-*(.*))\.jar$/;
      let locale = localeJar.exec(entry.leafName);
      if (locale) {
        let langName = locale[2];

        try {
          langName = bundle.GetStringFromName(langName);
        } catch (ex) {}

        let label = calGetString("calendar", "extractUsing", [langName]);
        if (locale[3] != "") {
          label += " (" + locale[3] + ")";
        }

        langs.push([label, locale[1]]);
      }
    }

    // sort
    let pref = "calendar.patterns.last.used.languages";
    let lastUsedLangs = cal.getPrefSafe(pref, "");

    function compare(lastUsedLangs) {
      return function compare(a, b) {
        let idx_a = lastUsedLangs.indexOf(a[1]);
        let idx_b = lastUsedLangs.indexOf(b[1]);

        if (idx_a == -1 && idx_b == -1) {
          return a[0].localeCompare(b[0]);
        } else if (idx_a != -1 && idx_b != -1) {
          return idx_a - idx_b;
        } else if (idx_a != -1) {
          return -1;
        } else {
          return 1;
        }
      }
    }

    langs.sort(compare(lastUsedLangs));

    while (localeList.hasChildNodes()) {
      localeList.removeChild(localeList.firstChild);
    }

    for (let i = 0; i < langs.length; i++) {
      let item;
      item = document.createElement("menuitem");
      item.setAttribute("label", langs[i][0]);
      item.setAttribute("value", langs[i][1]);
      localeList.appendChild(item);
    }
  },

  ExtractWithLocale: function ExtractWithLocale(event, isEvent) {
    let locale = event.target.value;
    this.extractFromEmail(isEvent, true, locale);
    event.stopPropagation();
  },

  extractFromEmail: function extractFromEmail(isEvent, fixedLang, fixedLocale) {
    let aConsoleService = Components.classes["@mozilla.org/consoleservice;1"]
                                    .getService(Components.interfaces.nsIConsoleService);

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
    //let baseUrl = "chrome://event-extract/content/locale/extract_LOCALE.properties"
    let baseUrl = "jar:resource://calendar/chrome/calendar-LOCALE.jar!/locale/LOCALE/calendar/calendar-extract.properties";
    let dayStart = cal.getPrefSafe("calendar.view.daystarthour", 6);
    let extractor;
    if (fixedLang) {
        extractor = new Extractor(baseUrl, fixedLocale, dayStart);
    } else {
        extractor = new Extractor(baseUrl, locale, dayStart, false);
    }
    let sel = GetMessagePaneFrame().getSelection();
    let collected = extractor.extract(title, content, date, sel);
    let guessed = extractor.guessStart(!isEvent);
    let endGuess = extractor.guessEnd(guessed, !isEvent);
    let allDay = (guessed.hour == null || guessed.minute == null) &&
                isEvent;

    let item;
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
      if (guessed.year != null)
        item.startDate.year = guessed.year;
      if (guessed.month != null)
        item.startDate.month = guessed.month - 1;
      if (guessed.day != null)
        item.startDate.day = guessed.day;
      if (guessed.hour != null)
        item.startDate.hour = guessed.hour;
      if (guessed.minute != null)
        item.startDate.minute = guessed.minute;

      item.endDate = item.startDate.clone();
      item.endDate.minute += cal.getPrefSafe("calendar.event.defaultlength", 60);

      if (endGuess.year != null)
        item.endDate.year = endGuess.year;
      if (endGuess.month != null)
        item.endDate.month = endGuess.month - 1;
      if (endGuess.day != null) {
        item.endDate.day = endGuess.day;
        if (allDay)
          item.endDate.day++;
      }
      if (endGuess.hour != null)
        item.endDate.hour = endGuess.hour;
      if (endGuess.minute != null)
        item.endDate.minute = endGuess.minute;
    } else {
      let dtz = cal.calendarDefaultTimezone();
      let dueDate = new Date();
      // set default
      dueDate.setHours(0);
      dueDate.setMinutes(0);
      dueDate.setSeconds(0);

      if (endGuess.year != null)
        dueDate.setYear(endGuess.year);
      if (endGuess.month  != null)
        dueDate.setMonth(endGuess.month - 1);
      if (endGuess.day != null)
        dueDate.setDate(endGuess.day);
      if (endGuess.hour != null)
        dueDate.setHours(endGuess.hour);
      if (endGuess.minute != null)
        dueDate.setMinutes(endGuess.minute);

      setItemProperty(item, "entryDate", cal.jsDateToDateTime(date, dtz));
      if (endGuess.year != null)
        setItemProperty(item, "dueDate", cal.jsDateToDateTime(dueDate, dtz));
    }

    let timeSpent = (new Date()).getTime() - time;
    aConsoleService.logStringMessage("[calExtract] Total time spent for conversion (including loading of dictionaries): " + timeSpent + "ms");

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
    let eventButton = document.getElementById("extractEventButton");
    let taskButton = document.getElementById("extractTaskButton");
    let state = (gFolderDisplay.selectedCount == 0);
    if (eventButton) {
      eventButton.disabled = state
    }
    if (taskButton) {
      taskButton.disabled = state;
    }
  }
}

extract.addListeners();